import { fireEvent, screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

type User = Pick<ReturnType<typeof userEvent.setup>, 'click' | 'selectOptions'>

// Integration tests follow the same workspace navigation as a reader. Revealing
// a mounted area never recreates its controls or resets its local filters.
function revealWorkspace(element: HTMLElement) {
  const area = element.closest<HTMLElement>('.planner-area')
  if (area?.hidden) {
    const button = document.querySelector<HTMLButtonElement>(`button[aria-controls="${area.id}"]`)
    if (!button) throw new Error(`No navigation button for ${area.id}`)
    fireEvent.click(button)
  }
}
export function plannerRole(role: string, options: { name: string | RegExp }) {
  if (role === 'region' && typeof options.name === 'string') {
    const area = [...document.querySelectorAll<HTMLElement>('.planner-area')].find(element => element.getAttribute('aria-label') === options.name)
    if (area) revealWorkspace(area)
  }
  const candidates = screen.queryAllByRole(role, {...options, hidden: true})
  const active = candidates.filter(element => !element.closest<HTMLElement>('.planner-area')?.hidden)
  const element = candidates.length === 1 ? candidates[0] : active.length === 1 ? active[0] : screen.getByRole(role, {...options, hidden: true})
  revealWorkspace(element)
  return element
}
export function withinPlanner(element: HTMLElement) {
  revealWorkspace(element)
  return within(element)
}
export async function openPlannerPanel(user: User, title: string) {
  const summaryText = screen.getByText(title, { exact: true })
  revealWorkspace(summaryText)
  const panel = summaryText.closest('details')
  if (!panel) throw new Error(`No disclosure for ${title}`)
  if (!panel.open) await user.click(panel.querySelector('summary')!)
}
export async function selectMain(user: User, name: 'Character' | 'Class', value: string) {
  const current = document.querySelector<HTMLButtonElement>('.planner-navigation button[aria-current]')
  const control = plannerRole('combobox', { name })
  await user.selectOptions(control, value)
  if (current && !current.hasAttribute('aria-current')) await user.click(current)
}
export function changeMain(name: 'Character' | 'Class', value: string) {
  const current = document.querySelector<HTMLButtonElement>('.planner-navigation button[aria-current]')
  fireEvent.change(plannerRole('combobox', { name }), { target: { value } })
  if (current && !current.hasAttribute('aria-current')) fireEvent.click(current)
}

export async function closePlannerPanel(user: User, title: string) {
  const summaryText = screen.getByText(title, { exact: true })
  revealWorkspace(summaryText)
  const panel = summaryText.closest('details')
  if (!panel) throw new Error(`No disclosure for ${title}`)
  if (panel.open) await user.click(panel.querySelector('summary')!)
}
