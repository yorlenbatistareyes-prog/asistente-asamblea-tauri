// src/lib/data/iconosMDI.ts
import { 
  mdiAccountGroup,
  mdiBriefcaseCheck,
  mdiInformationOutline,
  mdiAccount,
  mdiCog,
  mdiCalendarText,
  mdiBookOpenPageVariant,
  mdiTextBoxOutline 
} from '@mdi/js';

// Definimos el objeto con tipos estrictos de TS
export const IconosMDI: Record<string, string> = {
  Congregacion: mdiAccountGroup,
  Responsabilidades: mdiBriefcaseCheck,
  DetallesAsamblea: mdiInformationOutline,
  Persona: mdiAccount,
  Configuracion: mdiCog
};