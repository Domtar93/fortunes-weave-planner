// Character portraits are optional image files in src/assets/portraits/, named after the
// character (see that folder's README). Vite bundles whatever is there at build time; a
// character without a file keeps the initials crest. No image is ever fetched from elsewhere.
const files=import.meta.glob('./assets/portraits/*.{png,jpg,jpeg,webp,avif}',{eager:true,query:'?url',import:'default'}) as Record<string,string>

// "Mu (with growth)" shares Mu's picture; accents and spacing are ignored: "Hong Hua" -> hong-hua.
export function portraitSlug(name:string):string {
 return name.replace(/\([^)]*\)/gu,'').normalize('NFKD').replace(/[̀-ͯ]/gu,'')
  .toLowerCase().replace(/[^a-z0-9]+/gu,'-').replace(/^-+|-+$/gu,'')
}

const bySlug=new Map(Object.entries(files).map(([path,url])=>[path.split('/').pop()!.replace(/\.[^.]+$/u,'').toLowerCase(),url]))

export function portraitUrl(name:string):string|undefined {
 return bySlug.get(portraitSlug(name))
}

export function initialsOf(name:string):string {
 return name.replace(/\([^)]*\)/gu,'').split(/[\s-]+/u).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()
}
