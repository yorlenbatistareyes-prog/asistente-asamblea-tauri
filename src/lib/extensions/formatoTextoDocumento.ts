import { Extension } from '@tiptap/core';

export const OPCIONES_INTERLINEADO = ['1.0', '1.15', '1.5', '2.0'] as const;
export type InterlineadoDocumento = (typeof OPCIONES_INTERLINEADO)[number];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    lineHeight: {
      setLineHeight: (lineHeight: InterlineadoDocumento) => ReturnType;
    };
  }
}

export function crearExtensionTamanioFuente() {
  return Extension.create({
    name: 'fontSize',
    addOptions() {
      return { types: ['textStyle'] };
    },
    addGlobalAttributes() {
      return [{
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize.replace('px', ''),
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}px` };
            }
          }
        }
      }];
    },
    addCommands() {
      return {
        setFontSize: (fontSize: string) => ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
        unsetFontSize: () => ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).run()
      };
    }
  });
}

export function crearExtensionInterlineado() {
  return Extension.create({
    name: 'lineHeight',
    addOptions() {
      return { types: ['paragraph', 'heading'] };
    },
    addGlobalAttributes() {
      return [{
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: { lineHeight?: string | null }) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            }
          },
          marginTop: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.marginTop || null,
            renderHTML: (attributes: { marginTop?: string | null }) => {
              if (!attributes.marginTop) return {};
              return { style: `margin-top: ${attributes.marginTop}` };
            }
          },
          marginBottom: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.marginBottom || null,
            renderHTML: (attributes: { marginBottom?: string | null }) => {
              if (!attributes.marginBottom) return {};
              return { style: `margin-bottom: ${attributes.marginBottom}` };
            }
          }
        }
      }];
    },
    addCommands() {
      return {
                // @ts-ignore
        setLineHeight: (lineHeight: InterlineadoDocumento) => ({ commands, state }) => {
          const type = state.selection.$from.parent.type.name;
          if (!this.options.types.includes(type)) return false;
          return commands.updateAttributes(type, { lineHeight });
        }
      };
    }
  });
}