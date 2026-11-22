import {useState} from 'react'
import {initialsOf,portraitUrl} from './portraits'

// Hexagon character portrait. Shows the bundled picture when one exists, otherwise the
// character's initials. Always decorative: the character's name is printed beside it.
export default function Portrait({name,size='large',url=portraitUrl(name)}:{name:string;size?:'large'|'medium'|'small';url?:string}) {
 const [failed,setFailed]=useState<string>()
 const picture=url&&failed!==url?url:undefined
 return <span className={`unit-crest portrait-${size}${picture?' has-portrait':''}`} aria-hidden="true" data-testid="portrait">
  <span>{picture?<img src={picture} alt="" decoding="async" draggable={false} onError={()=>setFailed(picture)}/>:initialsOf(name)}</span>
 </span>
}
