"""Static DOM/CSS audit. This does not measure browser layout or certify accessibility."""
import sys, re, json, collections
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '.audit-tools'))
import tinycss2, cssselect2
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['index.html', 'routiq.html', 'chotadhobi.html', 'myfuturejobs.html', 'esgplatform.html', 'orchestration.html']
WIDTHS = [360, 390, 768, 900, 901, 1024, 1440, 1920]
EXTRA_SCREENS = [(844, 390), (1024, 600), (1280, 720)]

def media_matches(query, width, height, reduced=False):
    if 'print' in query: return False
    for op, axis, value in re.findall(r'(min|max)-(width|height)\s*:\s*([\d.]+)px', query):
        actual = width if axis == 'width' else height
        if op == 'min' and actual < float(value): return False
        if op == 'max' and actual > float(value): return False
    if 'prefers-reduced-motion:reduce' in query.replace(' ', '') and not reduced: return False
    if 'prefers-reduced-motion:no-preference' in query.replace(' ', '') and reduced: return False
    return True

def flatten(rules, width, height, reduced=False):
    for rule in rules:
        if rule.type == 'qualified-rule': yield rule
        elif rule.type == 'at-rule' and rule.content is not None:
            if rule.lower_at_keyword == 'media' and media_matches(tinycss2.serialize(rule.prelude), width, height, reduced):
                yield from flatten(tinycss2.parse_rule_list(rule.content, skip_whitespace=True, skip_comments=True), width, height, reduced)

def resolve(value, variables, depth=0):
    if depth > 15: return value
    return re.sub(r'var\((--[\w-]+)(?:,\s*([^()]*))?\)', lambda m: resolve(variables.get(m[1], m[2] or m[0]), variables, depth+1), value)

def colors(value):
    if re.fullmatch(r'#[0-9a-fA-F]{3,8}', value or ''):
        v=value[1:]
        if len(v) in (3,4): v=''.join(c*2 for c in v)
        if len(v) in (6,8): return tuple(int(v[i:i+2],16)/255 for i in (0,2,4))
    if value in ('white','black'): return (1,1,1) if value=='white' else (0,0,0)
    return None

def contrast(a,b):
    def lum(c): return sum(w*(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4) for x,w in zip(c,[.2126,.7152,.0722]))
    la,lb=sorted([lum(a),lum(b)])
    return round((lb+.05)/(la+.05),2)

def background_color(el, styles):
    if el is None: return (1,1,1)
    style = styles[el]
    value = style.get('background-color', style.get('background',''))
    if re.search(r'gradient|url\(', value): return None
    color = colors(value)
    if color: return color
    rgb = re.fullmatch(r'rgba?\(([^)]+)\)',value)
    if rgb:
        parts = [float(p.strip()) for p in rgb[1].split(',')]
        if len(parts) in (3,4):
            color=tuple(p/255 for p in parts[:3]); alpha=parts[3] if len(parts)==4 else 1
            parent=background_color(el.getparent(),styles)
            if parent is None: return None
            return tuple(alpha*c+(1-alpha)*p for c,p in zip(color,parent))
    return background_color(el.getparent(),styles)

def font_px(value, width):
    value=value or '16px'
    m=re.fullmatch(r'([\d.]+)(px|rem|vw)',value)
    if m: return float(m[1])*({'px':1,'rem':16,'vw':width/100}[m[2]])
    m=re.fullmatch(r'clamp\(([^,]+),([^,]+),([^,]+)\)',value)
    if m:
        numbers=[font_px(v.strip(),width) for v in m.groups()]
        return max(numbers[0],min(numbers[1],numbers[2]))
    return 16

def computed_styles(doc, sheets, width, height, reduced=False):
    matcher=cssselect2.Matcher(); serial=0
    for sheet in sheets:
        for rule in flatten(sheet,width,height,reduced):
            selector=tinycss2.serialize(rule.prelude).strip()
            try: selectors=cssselect2.compile_selector_list(selector)
            except cssselect2.SelectorError: continue
            declarations=[d for d in tinycss2.parse_declaration_list(rule.content,skip_whitespace=True,skip_comments=True) if d.type=='declaration']
            for s in selectors:
                if s.pseudo_element is None: matcher.add_selector(s,(serial,declarations))
            serial+=1
    computed={}
    for wrapper in cssselect2.ElementWrapper.from_html_root(doc).iter_subtree():
        parent=computed.get(wrapper.etree_element.getparent(),{})
        inherited={k:v for k,v in parent.items() if k.startswith('--') or k in ['color','font-family','font-size','font-weight','line-height','letter-spacing','text-rendering']}
        values={}
        for specificity,order,pseudo,(serial,decls) in matcher.match(wrapper):
            for d in decls:
                key=(bool(d.important),specificity,serial)
                if d.name not in values or key>=values[d.name][0]: values[d.name]=(key,tinycss2.serialize(d.value).strip())
        inline=tinycss2.parse_declaration_list(wrapper.etree_element.get('style',''),skip_comments=True,skip_whitespace=True)
        for d in inline:
            if d.type=='declaration':
                key=(bool(d.important),(1,0,0,0),serial+1)
                if d.name not in values or key>=values[d.name][0]: values[d.name]=(key,tinycss2.serialize(d.value).strip())
        inherited.update({k:v[1] for k,v in values.items()})
        variables={k:v for k,v in inherited.items() if k.startswith('--')}
        computed[wrapper.etree_element]={k:resolve(v,variables) for k,v in inherited.items()}
    return computed

def audit():
    reports=[]
    for file in PAGES:
        path=ROOT/file; text=path.read_text(encoding='utf-8'); doc=html.document_fromstring(text)
        sheets=[tinycss2.parse_stylesheet(s.text or '',skip_comments=True,skip_whitespace=True) for s in doc.xpath('//style')]
        for link in doc.xpath('//link[@rel="stylesheet"]'):
            href=link.get('href','')
            if not href.startswith(('http:','https:')) and (ROOT/href).is_file(): sheets.append(tinycss2.parse_stylesheet((ROOT/href).read_text(encoding='utf-8'),skip_comments=True,skip_whitespace=True))
        ids=[el.get('id') for el in doc.xpath('//*[@id]')]; duplicates=[k for k,v in collections.Counter(ids).items() if v>1]
        links=[]
        for el in doc.xpath('//*[@href or @src]'):
            for attr in ['href','src']:
                href=el.get(attr,'')
                if not href or href.startswith(('data:','http:','https:','mailto:','tel:')): continue
                target,_,fragment=href.partition('#')
                targetpath=ROOT/target if target else path
                if not targetpath.is_file(): links.append(href+' (missing file)')
                elif fragment:
                    targetdoc=doc if targetpath==path else html.document_fromstring(targetpath.read_text(encoding='utf-8'))
                    if not targetdoc.xpath('//*[@id=$fragment]',fragment=fragment): links.append(href+' (missing anchor)')
        issues=[]
        for el in doc.xpath('//img[not(@alt)]'): issues.append('Image missing alt')
        for el in doc.xpath('//iframe[not(@title)]'): issues.append('Iframe missing title')
        for el in doc.xpath('//button'):
            if not ''.join(el.itertext()).strip() and not el.get('aria-label') and not el.get('aria-labelledby'): issues.append('Button has no accessible name')
        for el in doc.xpath('//a[@target="_blank"]'):
            if not set(el.get('rel','').split()) & {'noopener','noreferrer'}: issues.append('External target lacks noopener/noreferrer')
        for el in doc.xpath('//*[@aria-controls or @aria-labelledby]'):
            for attr in ['aria-controls','aria-labelledby']:
                for idref in el.get(attr,'').split():
                    if idref not in ids: issues.append(attr+' missing '+idref)
        if len(doc.xpath('//h1'))!=1: issues.append('Expected exactly one h1')
        syntax=[]
        def syntax_walk(rules):
            for r in rules:
                if r.type=='error': syntax.append(r.message)
                elif r.type=='qualified-rule':
                    for d in tinycss2.parse_declaration_list(r.content,skip_comments=True,skip_whitespace=True):
                        if d.type=='error': syntax.append(d.message)
                elif r.type=='at-rule' and r.lower_at_keyword=='media' and r.content:
                    syntax_walk(tinycss2.parse_rule_list(r.content,skip_comments=True,skip_whitespace=True))
        for sheet in sheets: syntax_walk(sheet)
        matrix=[]; contrast_issues={}; unresolved={}; minimum_width_risks={}
        for theme in ['light','dark']:
            doc.set('data-theme',theme)
            for width,height in [(w,800 if w<1024 else 900) for w in WIDTHS]+EXTRA_SCREENS:
                styles=computed_styles(doc,sheets,width,height)
                header=doc.xpath('//header')[0]; nav=header.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," nav-links ") or contains(concat(" ",normalize-space(@class)," ")," pk-nav-links ")]')[0]
                toggle=header.xpath('.//button[contains(@class,"theme-toggle")]')[0]
                link=nav.xpath('./a')[0]
                body=doc.xpath('//body')[0]; b=styles[body]; ink=colors(b.get('color')); paper=colors(b.get('background')) or colors(b.get('background-color'))
                matrix.append({'theme':theme,'width':width,'height':height,'headerHeight':styles[header].get('height'),'navDisplay':styles[nav].get('display'),'navFont':styles[link].get('font-family'),'navLineHeight':styles[link].get('line-height'),'toggleSize':[styles[toggle].get('width'),styles[toggle].get('height')],'bodyContrast':contrast(ink,paper) if ink and paper else None})
                if width in (390,1024) and height in (800,900):
                    for el,style in styles.items():
                        for prop,value in style.items():
                            if not prop.startswith('--') and 'var(' in value: unresolved[(theme,el.tag,el.get('class',''),prop)]=value
                        direct=(el.text or '').strip()
                        if not direct or el.tag in ('script','style','title','meta','link','head'): continue
                        if any(a.tag in ('script','style') for a in el.iterancestors()): continue
                        # Hidden menus and collapsed disclosures cannot contribute visible text.
                        if any(styles[a].get('display')=='none' for a in [el]+list(el.iterancestors())): continue
                        if any(a.tag=='details' and 'open' not in a.attrib and el.tag!='summary' for a in el.iterancestors()): continue
                        fg=colors(style.get('color')); bg=background_color(el,styles)
                        if fg and bg:
                            ratio=contrast(fg,bg); px=font_px(style.get('font-size'),width)
                            weight=int(style.get('font-weight','400')) if style.get('font-weight','400').isdigit() else 400
                            minimum=3 if px>=24 or px>=18.66 and weight>=700 else 4.5
                            if ratio<minimum:
                                contrast_issues[(theme,el.tag,el.get('class',''),direct[:70])]={ 'ratio':ratio,'required':minimum,'color':style.get('color'),'background':style.get('background-color',style.get('background')), 'width':width }
                        fixed=re.fullmatch(r'(\d+)px',style.get('min-width',''))
                        if fixed and int(fixed[1])>width and not any(styles[a].get('overflow')=='auto' or styles[a].get('overflow-x')=='auto' for a in el.iterancestors()): minimum_width_risks[(el.tag,el.get('class',''))]=style.get('min-width')
        reports.append({'page':file,'bytes':path.stat().st_size,'embeddedImageChars':sum(len(m[1]) for m in re.finditer(r'data:image/[^;]+;base64,([^"\s)]+)',text)),'duplicateIds':duplicates,'brokenLocalLinks':links,'accessibilityMarkupIssues':issues,'cssSyntaxErrors':syntax,'potentialContrastIssues':[{'theme':k[0],'tag':k[1],'class':k[2],'text':k[3],**v} for k,v in contrast_issues.items()],'unresolvedVariables':[{'theme':k[0],'tag':k[1],'class':k[2],'property':k[3],'value':v} for k,v in unresolved.items()],'fixedMinimumWidthRisks':[{'tag':k[0],'class':k[1],'minWidth':v} for k,v in minimum_width_risks.items()],'matrix':matrix})
    out=ROOT/'audit';out.mkdir(exist_ok=True)
    (out/'results.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
    for r in reports: print(json.dumps({k:v for k,v in r.items() if k!='matrix'}))
    return reports

if __name__=='__main__': audit()
