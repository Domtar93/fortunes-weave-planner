// "Report a correction" opens the repository's data-correction issue form, prefilled with the
// current character and class. Hidden when no repository is configured (local builds).
export function correctionUrl(characterName: string, className: string, repository = import.meta.env.VITE_REPO_URL): string | undefined {
  if (!repository || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/u.test(repository)) return undefined
  const query = new URLSearchParams({ template: 'data-correction.yml', title: `Data correction: ${characterName} / ${className}`, character: characterName, class: className })
  return `${repository}/issues/new?${query}`
}
