/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Published address ending in "/", used for the social preview (see .env). */
  readonly VITE_SITE_URL?: string
  /** GitHub repository URL; when set, the footer shows "Report a correction". */
  readonly VITE_REPO_URL?: string
}
