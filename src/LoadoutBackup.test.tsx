import { plannerRole } from './plannerTestUtils'
import { openPlannerPanel } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoadoutBackup from './LoadoutBackup'
import FullBuildLoadouts from './FullBuildLoadouts'
import { createLoadout, LOADOUT_KEY, type BuildLoadout } from './loadouts'
import { BACKUP_FILENAME, formatLoadoutBackup, MAX_BACKUP_BYTES } from './loadoutBackupModel'
const saved = () => createLoadout('Plan', { characterName: 'Alexandra', className: 'Gladiator', weaponId: null, mountId: null, battalionId: null, abilities: [] }, [], '2026-10-26T01:00:00.000Z', 'one')
const file = (text: string) => { const f = new File([text], 'loadouts.json', { type: 'application/json' }); Object.defineProperty(f, 'text', { configurable: true, value: async () => text }); return f }
const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
const open = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByText('Back up or import full loadouts', { exact: true }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); for (const [key, desc] of [['createObjectURL', createDescriptor], ['revokeObjectURL', revokeDescriptor]] as const) { if (desc) Object.defineProperty(URL, key, desc); else Reflect.deleteProperty(URL, key) } })
describe('local loadout backup workflow', () => {
  it('downloads exact validated JSON with the shared object-URL lifecycle and correct MIME', async () => {
    const user = userEvent.setup(), create = vi.fn((_blob: Blob) => 'blob:backup'), revoke = vi.fn(), data = [saved()]
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe(BACKUP_FILENAME); expect(this.isConnected).toBe(true) })
    render(<LoadoutBackup loadouts={data} disabled={false} onImport={vi.fn()} />); await open(user); await user.click(plannerRole('button', { name: 'Download loadout backup' }))
    expect(create.mock.calls[0][0].type).toBe('application/json;charset=utf-8'); expect(click).toHaveBeenCalledOnce(); expect(document.querySelector('a[download]')).toBeNull()
    const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsText(create.mock.calls[0][0]) })
    expect(text).toBe(formatLoadoutBackup(data)); expect(screen.getByRole('status').textContent).toContain('download started'); expect(screen.queryByRole('textbox')).toBeNull()
  })
  it('offers selected manual JSON after unsupported downloads and never auto-copies', async () => {
    const user = userEvent.setup(); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: undefined })
    render(<LoadoutBackup loadouts={[saved()]} disabled={false} onImport={vi.fn()} />); await open(user); await user.click(plannerRole('button', { name: 'Download loadout backup' }))
    const text = screen.getByRole('textbox', { name: 'Loadout backup JSON for manual copying' }) as HTMLTextAreaElement
    expect(text.value).toBe(formatLoadoutBackup([saved()])); expect(document.activeElement).toBe(text); expect([text.selectionStart, text.selectionEnd]).toEqual([0, text.value.length])
    expect(screen.queryByRole('status')).toBeNull(); expect(screen.getByRole('alert').textContent).toContain('could not start')
  })
  it('previews an uploaded file before explicit confirmation and supports cancellation', async () => {
    const user = userEvent.setup(), onImport = vi.fn(); render(<LoadoutBackup loadouts={[]} disabled={false} onImport={onImport} />); await open(user)
    await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), file(formatLoadoutBackup([saved()])))
    expect(onImport).not.toHaveBeenCalled(); expect(screen.getByLabelText('Loadout import preview').textContent).toContain('1 new')
    await user.click(plannerRole('button', { name: 'Cancel loadout import' })); expect(onImport).not.toHaveBeenCalled()
    await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), file(formatLoadoutBackup([saved()])))
    await user.click(plannerRole('button', { name: 'Confirm loadout import' })); expect(onImport).toHaveBeenCalledExactlyOnceWith([saved()])
  })
  it('blocks name/ID conflicts and skips identical records rather than replacing local saves', async () => {
    const user = userEvent.setup(), onImport = vi.fn(), data = saved(); render(<LoadoutBackup loadouts={[data]} disabled={false} onImport={onImport} />); await open(user)
    await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), file(formatLoadoutBackup([{ ...data, name: 'Different' }])))
    expect(screen.getByRole('alert').textContent).toContain('conflicts'); expect((plannerRole('button', { name: 'Confirm loadout import' }) as HTMLButtonElement).disabled).toBe(true)
    await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), file(formatLoadoutBackup([data])))
    expect(screen.getByLabelText('Loadout import preview').textContent).toContain('1 identical skipped'); expect(onImport).not.toHaveBeenCalled()
  })
  it.each(['malformed', 'oversized', 'read-error'])('reports %s files without saving anything', async failure => {
    const user = userEvent.setup(), onImport = vi.fn(); render(<LoadoutBackup loadouts={[]} disabled={false} onImport={onImport} />); await open(user)
    const f = file('{bad'); if (failure === 'oversized') Object.defineProperty(f, 'size', { value: MAX_BACKUP_BYTES + 1 }); if (failure === 'read-error') Object.defineProperty(f, 'text', { configurable: true, value: () => Promise.reject(new Error('Read denied')) })
    await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), f); expect(screen.getByRole('alert')).toBeDefined(); expect(onImport).not.toHaveBeenCalled()
  })
  it('ignores a late file result after a newer choice or unmount', async () => {
    const user = userEvent.setup(), props = { loadouts: [] as BuildLoadout[], disabled: false, onImport: vi.fn() }, view = render(<LoadoutBackup {...props} />); await open(user)
    let finish!: (text: string) => void; const f = file(''); Object.defineProperty(f, 'text', { configurable: true, value: () => new Promise<string>(resolve => { finish = resolve }) })
    await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), f); await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), file(formatLoadoutBackup([])))
    await act(async () => finish(formatLoadoutBackup([saved()]))); expect(screen.getByLabelText('Loadout import preview').textContent).toContain('0 new')
    view.unmount(); expect(props.onImport).not.toHaveBeenCalled()
  })
  it('persists a confirmed add-only import through the parent without loading it into the planner', async () => {
    const user = userEvent.setup(), onLoad = vi.fn(), loadout = saved(); render(<FullBuildLoadouts selection={loadout} onLoad={onLoad} />)
    await openPlannerPanel(user, 'Full Build Loadouts'); await open(user)
    await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), file(formatLoadoutBackup([loadout]))); expect(localStorage.getItem(LOADOUT_KEY)).toBeNull()
    await user.click(plannerRole('button', { name: 'Confirm loadout import' })); expect(JSON.parse(localStorage.getItem(LOADOUT_KEY)!).loadouts).toEqual([loadout]); expect(onLoad).not.toHaveBeenCalled()
  })
  it('limits preview rows while explicitly importing every record from a larger backup', async () => {
    const base = saved(), records = Array.from({ length: 80 }, (_, index) => ({ ...base, id: `large-${index}`, name: `Large plan ${index}` }))
    const user = userEvent.setup(), onImport = vi.fn(); render(<LoadoutBackup loadouts={[]} disabled={false} onImport={onImport} />); await open(user)
    await user.upload(screen.getByLabelText('Choose full-loadout JSON backup'), file(formatLoadoutBackup(records)))
    const preview = screen.getByLabelText('Loadout import preview'); expect(preview.querySelectorAll('li')).toHaveLength(25); expect(preview.textContent).toContain('Confirm imports all 80 new loadouts')
    await user.click(plannerRole('button', { name: 'Confirm loadout import' })); expect(onImport).toHaveBeenCalledExactlyOnceWith(records)
  })
})
