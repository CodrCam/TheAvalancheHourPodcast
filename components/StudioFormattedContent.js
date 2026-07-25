import styles from '../styles/Studio.module.css';

function lineType(line) {
  const trimmed = line.trim();
  if (!trimmed) return 'blank';
  if (/^#{2,3}\s+/.test(trimmed)) return 'heading';
  if (/^[-*•]\s+/.test(trimmed)) return 'bullet';
  if (/^\d+[.)]\s+/.test(trimmed)) return 'number';
  return 'paragraph';
}

export function parseStudioText(value = '') {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const type = lineType(lines[index]);
    if (type === 'blank') {
      index += 1;
      continue;
    }

    if (type === 'bullet' || type === 'number') {
      const items = [];
      while (index < lines.length && lineType(lines[index]) === type) {
        items.push(
          lines[index]
            .trim()
            .replace(type === 'bullet' ? /^[-*•]\s+/ : /^\d+[.)]\s+/, '')
        );
        index += 1;
      }
      blocks.push({ type, items });
      continue;
    }

    if (type === 'heading') {
      blocks.push({
        type,
        text: lines[index].trim().replace(/^#{2,3}\s+/, ''),
      });
      index += 1;
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && lineType(lines[index]) === 'paragraph') {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

export default function StudioFormattedContent({ value }) {
  return (
    <div className={styles.formattedContent}>
      {parseStudioText(value).map((block, index) => {
        if (block.type === 'bullet') {
          return (
            <ul key={`bullet-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'number') {
          return (
            <ol key={`number-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'heading') {
          return <h3 key={`heading-${index}`}>{block.text}</h3>;
        }

        return <p key={`paragraph-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}
