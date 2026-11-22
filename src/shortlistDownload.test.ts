import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadShortlistText, shortlistFilename } from './shortlistDownload'

const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
function setup() {
  const create = vi.fn((_blob: Blob) => 'blob:shortlist-test'), revoke = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return { create, revoke, click }
}
afterEach(() => {
  vi.useRealTimers(); vi.restoreAllMocks()
  if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor); else Reflect.deleteProperty(URL, 'createObjectURL')
  if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor); else Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('shortlist download filename', () => {
  it.each([
    ['Alexandra', 'alexandra'], ['Sofia', 'sofia'], ['Mu', 'mu'], ['Mu (with growth)', 'mu-with-growth'],
    ['../C:\\Mu<>:"/\\|?* .', 'c-mu'], ['', 'character'], [' . / \\ : * ? " < > | ', 'character'],
    ['CON', 'character-con'], ['nul.txt', 'nul-txt'], ['LPT¹', 'character-lpt1'],
    ['Mu’s α + Γ', 'mu-s-α-γ'], ['Élodie', 'elodie'],
  ])('sanitizes %j into a safe descriptive filename', (input, stem) => {
    const filename = shortlistFilename(input)
    expect(filename).toBe(`${stem}-ability-shortlist.txt`)
    expect(filename).not.toMatch(/[<>:"/\\|?*\x00-\x1f]/)
    expect(filename).not.toMatch(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i)
  })
  it('limits long Unicode names without splitting characters or leaving trailing separators', () => {
    const filename = shortlistFilename('𐐀'.repeat(200) + ' ./')
    expect(Array.from(filename.replace('-ability-shortlist.txt', ''))).toHaveLength(80)
    expect(filename).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
    expect(shortlistFilename('Mu')).not.toBe(shortlistFilename('Mu (with growth)'))
  })
})

describe('browser text download lifecycle', () => {
  it('uses the exact text and MIME type, clicks a temporary anchor, then delays URL release', async () => {
    vi.useFakeTimers()
    const { create, revoke, click } = setup()
    const text = "Mu’s α—Γ / 'Sword'!G2\nProficiency: Sword S+\nFlying C+"
    let clicked: HTMLAnchorElement | undefined
    click.mockImplementation(function (this: HTMLAnchorElement) { clicked = this; expect(this.isConnected).toBe(true) })
    downloadShortlistText(text, 'mu-ability-shortlist.txt')
    const blob = create.mock.calls[0][0]
    expect(blob.type).toBe('text/plain;charset=utf-8')
    expect(clicked!.download).toBe('mu-ability-shortlist.txt'); expect(clicked!.href).toBe('blob:shortlist-test')
    expect(clicked!.hidden).toBe(true); expect(clicked!.isConnected).toBe(false)
    expect(document.querySelector('a[download]')).toBeNull(); expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999); expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:shortlist-test')
    vi.useRealTimers()
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob)
    })
    expect(Array.from(new Uint8Array(bytes))).toEqual(Array.from(new TextEncoder().encode(text)))
  })
  it.each(['click', 'append'])('immediately releases the URL and removes the anchor after a %s failure', stage => {
    const { revoke, click } = setup()
    if (stage === 'click') click.mockImplementation(() => { throw new Error('Blocked') })
    else vi.spyOn(document.body, 'appendChild').mockImplementation(() => { throw new Error('Unavailable') })
    expect(() => downloadShortlistText('exact text', 'alexandra-ability-shortlist.txt')).toThrow()
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:shortlist-test'); expect(document.querySelector('a[download]')).toBeNull()
  })
  it('does not create a URL when cleanup support is unavailable', () => {
    const { create } = setup()
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: undefined })
    expect(() => downloadShortlistText('text', 'safe.txt')).toThrow('Browser downloads unavailable')
    expect(create).not.toHaveBeenCalled(); expect(document.querySelector('a[download]')).toBeNull()
  })
  it('does not attach an anchor or leave a URL when URL creation fails', () => {
    const { create, revoke, click } = setup()
    create.mockImplementation(() => { throw new Error('Blocked') })
    expect(() => downloadShortlistText('text', 'safe.txt')).toThrow('Blocked')
    expect(revoke).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled(); expect(document.querySelector('a[download]')).toBeNull()
  })
})
