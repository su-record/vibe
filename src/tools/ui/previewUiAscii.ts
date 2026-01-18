// UI Preview tool - ASCII art visualization before development

import { ToolResult, ToolDefinition } from '../../types/tool.js';

interface UIComponent {
  type: string;
  label?: string;
  children?: UIComponent[];
  width?: number;
  height?: number;
}

export const previewUiAsciiDefinition: ToolDefinition = {
  name: 'preview_ui_ascii',
  description: 'create page|build UI|design component|make page|develop page|layout|screen design - Preview UI before coding',
  inputSchema: {
    type: 'object',
    properties: {
      page_name: {
        type: 'string',
        description: 'Name of the page or component (e.g., "Login Page", "Dashboard")'
      },
      layout_type: {
        type: 'string',
        enum: ['sidebar', 'header-footer', 'grid', 'centered', 'split', 'custom'],
        description: 'Layout structure type (default: header-footer)'
      },
      components: {
        type: 'array',
        description: 'List of UI components to include',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Component type (header, sidebar, button, input, card, etc.)' },
            label: { type: 'string', description: 'Component label or text' },
            position: { type: 'string', description: 'Position in layout (top, left, center, right, bottom)' }
          }
        }
      },
      width: {
        type: 'number',
        description: 'Preview width in characters (default: 60)'
      },
      responsive: {
        type: 'boolean',
        description: 'Show mobile view preview (default: false)'
      }
    },
    required: ['page_name', 'components']
  },
  annotations: {
    title: 'Preview UI (ASCII)',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function previewUiAscii(args: {
  page_name: string;
  layout_type?: string;
  components: Array<{ type: string; label?: string; position?: string }>;
  width?: number;
  responsive?: boolean;
}): Promise<ToolResult> {
  const {
    page_name,
    layout_type = 'header-footer',
    components,
    width = 60,
    responsive = false
  } = args;

  // ASCII art generation
  const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
  const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';
  const separator = '├' + '─'.repeat(width - 2) + '┤';
  const emptyLine = '│' + ' '.repeat(width - 2) + '│';

  const createLine = (text: string, align: 'left' | 'center' | 'right' = 'left') => {
    const contentWidth = width - 4;
    let content = text.slice(0, contentWidth);

    if (align === 'center') {
      const padding = Math.floor((contentWidth - content.length) / 2);
      content = ' '.repeat(padding) + content + ' '.repeat(contentWidth - padding - content.length);
    } else if (align === 'right') {
      content = ' '.repeat(contentWidth - content.length) + content;
    } else {
      content = content + ' '.repeat(contentWidth - content.length);
    }

    return '│ ' + content + ' │';
  };

  const createBox = (label: string, w: number, h: number) => {
    const lines = [];
    lines.push('┌' + '─'.repeat(w - 2) + '┐');

    for (let i = 0; i < h - 2; i++) {
      if (i === Math.floor((h - 2) / 2)) {
        const padding = Math.floor((w - 4 - label.length) / 2);
        const text = ' '.repeat(padding) + label + ' '.repeat(w - 4 - padding - label.length);
        lines.push('│ ' + text + ' │');
      } else {
        lines.push('│ ' + ' '.repeat(w - 4) + ' │');
      }
    }

    lines.push('└' + '─'.repeat(w - 2) + '┘');
    return lines;
  };

  let preview: string[] = [];

  // Generate preview based on layout type
  preview.push(topBorder);

  switch (layout_type) {
    case 'header-footer': {
      // Header
      const header = components.find(c => c.type === 'header' || c.position === 'top');
      if (header) {
        preview.push(createLine(header.label || 'Header', 'left'));
        preview.push(separator);
      }

      // Main content
      const mainComponents = components.filter(c =>
        c.type !== 'header' && c.type !== 'footer' && c.position !== 'top' && c.position !== 'bottom'
      );

      preview.push(emptyLine);
      mainComponents.forEach(comp => {
        const label = comp.label || comp.type.toUpperCase();
        if (comp.type === 'button') {
          preview.push(createLine(`  [${label}]`, 'center'));
        } else if (comp.type === 'input') {
          preview.push(createLine(`  ${label}: [____________]`, 'left'));
        } else if (comp.type === 'card') {
          preview.push(createLine(`  ┌─ ${label} ─────────────┐`, 'left'));
          preview.push(createLine(`  │ Content here...      │`, 'left'));
          preview.push(createLine(`  └──────────────────────┘`, 'left'));
        } else {
          preview.push(createLine(`  ${label}`, 'left'));
        }
      });
      preview.push(emptyLine);

      // Footer
      const footer = components.find(c => c.type === 'footer' || c.position === 'bottom');
      if (footer) {
        preview.push(separator);
        preview.push(createLine(footer.label || 'Footer', 'center'));
      }
      break;
    }

    case 'sidebar': {
      // Header
      const header = components.find(c => c.type === 'header' || c.position === 'top');
      if (header) {
        preview.push(createLine(header.label || 'Header', 'left'));
        preview.push(separator);
      }

      // Sidebar + Content
      const sidebarWidth = Math.floor(width * 0.25);
      const contentWidth = width - sidebarWidth - 5;

      const sidebar = components.find(c => c.type === 'sidebar' || c.position === 'left');
      const mainComponents = components.filter(c =>
        c.type !== 'header' && c.type !== 'footer' && c.type !== 'sidebar' &&
        c.position !== 'top' && c.position !== 'bottom' && c.position !== 'left'
      );

      preview.push('│ ┌' + '─'.repeat(sidebarWidth - 2) + '┐' + ' '.repeat(contentWidth - sidebarWidth + 3) + '│');
      preview.push('│ │' + (sidebar?.label || 'Nav').padEnd(sidebarWidth - 2) + '│  Content Area' + ' '.repeat(contentWidth - 15) + '│');

      const navItems = mainComponents.slice(0, 3);
      navItems.forEach((item, idx) => {
        const navLabel = `${item.label || item.type}`.slice(0, sidebarWidth - 4);
        const contentLabel = idx === 0 ? `┌─ ${mainComponents[0]?.label || 'Main'} ─┐` : '';
        preview.push('│ │ ' + navLabel.padEnd(sidebarWidth - 3) + '│  ' + contentLabel.padEnd(contentWidth - 3) + '│');
      });

      preview.push('│ └' + '─'.repeat(sidebarWidth - 2) + '┘' + ' '.repeat(contentWidth - sidebarWidth + 3) + '│');

      // Footer
      const footer = components.find(c => c.type === 'footer' || c.position === 'bottom');
      if (footer) {
        preview.push(separator);
        preview.push(createLine(footer.label || 'Footer', 'center'));
      }
      break;
    }

    case 'grid': {
      preview.push(createLine('Grid Layout', 'center'));
      preview.push(separator);

      const gridComponents = components.filter(c => c.type !== 'header' && c.type !== 'footer');
      const cols = Math.ceil(Math.sqrt(gridComponents.length));
      const cellWidth = Math.floor((width - 4) / cols) - 2;

      for (let i = 0; i < gridComponents.length; i += cols) {
        const row = gridComponents.slice(i, i + cols);
        preview.push('│ ' + row.map(c => {
          const label = (c.label || c.type).slice(0, cellWidth - 2);
          return '┌' + label.padEnd(cellWidth - 2, '─') + '┐';
        }).join(' ') + ' '.repeat(width - 4 - row.length * (cellWidth + 1)) + ' │');

        preview.push('│ ' + row.map(c => '│' + ' '.repeat(cellWidth - 2) + '│').join(' ') + ' '.repeat(width - 4 - row.length * (cellWidth + 1)) + ' │');

        preview.push('│ ' + row.map(c => '└' + '─'.repeat(cellWidth - 2) + '┘').join(' ') + ' '.repeat(width - 4 - row.length * (cellWidth + 1)) + ' │');
      }
      break;
    }

    case 'centered': {
      const main = components[0];
      preview.push(emptyLine);
      preview.push(emptyLine);
      preview.push(createLine(main?.label || 'Main Content', 'center'));

      components.slice(1).forEach(comp => {
        if (comp.type === 'button') {
          preview.push(createLine(`[${comp.label || 'Button'}]`, 'center'));
        } else if (comp.type === 'input') {
          preview.push(createLine(`${comp.label || 'Input'}: [____________]`, 'center'));
        }
      });

      preview.push(emptyLine);
      preview.push(emptyLine);
      break;
    }

    case 'split': {
      const leftWidth = Math.floor((width - 5) / 2);
      const rightWidth = width - leftWidth - 5;

      preview.push('│ ┌' + '─'.repeat(leftWidth) + '┐ ┌' + '─'.repeat(rightWidth) + '┐ │');

      const left = components.find(c => c.position === 'left') || components[0];
      const right = components.find(c => c.position === 'right') || components[1];

      preview.push('│ │' + (left?.label || 'Left').padEnd(leftWidth) + '│ │' + (right?.label || 'Right').padEnd(rightWidth) + '│ │');

      for (let i = 0; i < 5; i++) {
        preview.push('│ │' + ' '.repeat(leftWidth) + '│ │' + ' '.repeat(rightWidth) + '│ │');
      }

      preview.push('│ └' + '─'.repeat(leftWidth) + '┘ └' + '─'.repeat(rightWidth) + '┘ │');
      break;
    }
  }

  preview.push(bottomBorder);

  // Mobile view if responsive
  let mobilePreview = '';
  if (responsive) {
    const mobileWidth = 30;
    const mobileTop = '┌' + '─'.repeat(mobileWidth - 2) + '┐';
    const mobileBottom = '└' + '─'.repeat(mobileWidth - 2) + '┘';

    mobilePreview = '\n\n📱 Mobile View:\n';
    mobilePreview += mobileTop + '\n';
    components.forEach(comp => {
      const label = (comp.label || comp.type).slice(0, mobileWidth - 4);
      mobilePreview += '│ ' + label.padEnd(mobileWidth - 4) + ' │\n';
    });
    mobilePreview += mobileBottom;
  }

  const result = {
    page_name,
    layout_type,
    ascii_preview: preview.join('\n'),
    mobile_preview: responsive ? mobilePreview : null,
    components_count: components.length,
    message: '✅ Proceed with this layout? Approve to start code generation.',
    action: 'preview_ui_ascii',
    status: 'awaiting_confirmation'
  };

  return {
    content: [{
      type: 'text',
      text: `🎨 UI Preview: ${page_name}\n\n${preview.join('\n')}${mobilePreview}\n\n${result.message}`
    }]
  };
}
