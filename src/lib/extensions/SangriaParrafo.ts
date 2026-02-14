import { Extension } from '@tiptap/core';

export interface SangriaParrafoOptions {
  indentStep: number;      // px por nivel
  maxIndent: number;       // niveles máximos
  firstLineIndent: number; // px de sangría de primera línea
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sangriaParrafo: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
      toggleFirstLineIndent: () => ReturnType;
    };
  }
}

export const SangriaParrafo = Extension.create<SangriaParrafoOptions>({
  name: 'sangriaParrafo',

  addOptions() {
    return {
      indentStep: 36,       // Word: 1.27 cm
      maxIndent: 5,
      firstLineIndent: 36,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          indentLevel: {
            default: 0,
            parseHTML: element => {
              const ml = element.style.marginLeft;
              if (!ml) return 0;
              return Math.round(parseInt(ml) / this.options.indentStep);
            },
            renderHTML: attrs => {
              const level = attrs.indentLevel || 0;
              return {
                style: `margin-left: ${level * this.options.indentStep}px;`
              };
            },
          },
          firstLine: {
            default: false,
            parseHTML: element => {
              const ti = element.style.textIndent;
              return ti && parseInt(ti) !== 0;
            },
            renderHTML: attrs => {
              if (!attrs.firstLine) return {};
              return {
                style: `text-indent: ${this.options.firstLineIndent}px;`
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ commands, state }) => {
          const { from, to } = state.selection;
          let tr = state.tr;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph') {
              const current = node.attrs.indentLevel || 0;
              const next = Math.min(current + 1, this.options.maxIndent);
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indentLevel: next,
              });
            }
          });

          return commands.command(({ editor }) => {
             editor.view.dispatch(tr);
             return true;
         });
        },

      decreaseIndent:
        () =>
        ({ commands, state }) => {
          const { from, to } = state.selection;
          let tr = state.tr;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph') {
              const current = node.attrs.indentLevel || 0;
              const next = Math.max(current - 1, 0);
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indentLevel: next,
              });
            }
          });

          return commands.command(({ editor }) => {
             editor.view.dispatch(tr);
             return true;
        });
        },

      toggleFirstLineIndent:
        () =>
        ({ commands, state }) => {
          const { from, to } = state.selection;
          let tr = state.tr;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph') {
              const current = node.attrs.firstLine || false;
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                firstLine: !current,
              });
            }
          });

          return commands.command(({ editor }) => {
            editor.view.dispatch(tr);
            return true;
         });

        },
    };
  },
});
