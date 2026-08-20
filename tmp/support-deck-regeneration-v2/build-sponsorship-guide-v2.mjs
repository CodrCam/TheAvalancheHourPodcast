import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const ROOT = '/Users/camerongriffin/projects/TheAvalancheHour';
const TMP = path.join(ROOT, 'tmp/support-deck-regeneration-v2');
const STARTER = path.join(TMP, 'template-starter.pptx');
const OUT = path.join(TMP, 'avalanche-hour-s11-sponsorship-guide.pptx');
const RENDER_DIR = path.join(TMP, 'final-render');
const LAYOUT_DIR = path.join(TMP, 'final-layout');

const W = 1280;
const H = 720;

const C = {
  ink: '#10222D',
  deep: '#0B202A',
  teal: '#173B4A',
  snow: '#F4F6F2',
  white: '#FFFFFF',
  ice: '#C8E4ED',
  paleIce: '#DCE9E9',
  signal: '#EF6F35',
  signalDark: '#A8431E',
  soft: '#405965',
  muted: '#526A75',
  line: '#AAB8BC',
};

const F = { display: 'Arial', body: 'Arial' };

const assets = {
  logo: path.join(ROOT, 'public/images/avalanche-hour-podcast-logo-white.png'),
  cover: path.join(TMP, 'prepared-assets/cover-1280x720.jpg'),
  audience: path.join(TMP, 'prepared-assets/audience-480x720.jpg'),
  profile: path.join(TMP, 'prepared-assets/profile-430x720.jpg'),
  momentum: path.join(TMP, 'prepared-assets/momentum-1280x720.jpg'),
  cadence: path.join(TMP, 'prepared-assets/cadence-1280x720.jpg'),
  value: path.join(TMP, 'prepared-assets/value-1280x720.jpg'),
  close: path.join(TMP, 'prepared-assets/close-1280x720.jpg'),
};

async function bytes(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addBox(slide, name, position, fill, line = { style: 'solid', fill: 'none', width: 0 }) {
  return slide.shapes.add({ geometry: 'rect', name, position, fill, line });
}

function addCircle(slide, name, position, fill, line = { style: 'solid', fill: 'none', width: 0 }) {
  return slide.shapes.add({ geometry: 'ellipse', name, position, fill, line });
}

function addText(slide, {
  name,
  text,
  left,
  top,
  width,
  height,
  fontSize = 24,
  color = C.ink,
  typeface = F.body,
  bold = false,
  italic = false,
  alignment = 'left',
  verticalAlignment = 'top',
  lineSpacing = 1.12,
  fill = 'none',
}) {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    name,
    position: { left, top, width, height },
    fill,
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize,
    color,
    typeface,
    bold,
    italic,
    alignment,
    verticalAlignment,
    lineSpacing,
    autoFit: 'none',
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addRule(slide, name, left, top, width, color = C.line, weight = 1) {
  return slide.shapes.add({
    geometry: 'line',
    name,
    position: { left, top, width, height: 0 },
    fill: 'none',
    line: { style: 'solid', fill: color, width: weight },
  });
}

function addVRule(slide, name, left, top, height, color = C.line, weight = 1) {
  return slide.shapes.add({
    geometry: 'line',
    name,
    position: { left, top, width: 0, height },
    fill: 'none',
    line: { style: 'solid', fill: color, width: weight },
  });
}

function addEyebrow(slide, text, left, top, width, color = C.signalDark) {
  return addText(slide, {
    name: `eyebrow-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    text: text.toUpperCase(),
    left,
    top,
    width,
    height: 26,
    fontSize: 16,
    color,
    bold: true,
    lineSpacing: 1,
  });
}

function addTitle(slide, text, left, top, width, height, color = C.ink, size = 54) {
  return addText(slide, {
    name: 'slide-title',
    text,
    left,
    top,
    width,
    height,
    fontSize: size,
    color,
    typeface: F.display,
    bold: true,
    lineSpacing: 0.9,
  });
}

function addFooter(slide, pageNumber, dark = false) {
  const color = dark ? '#FFFFFFB8' : C.muted;
  const rule = dark ? '#C8E4ED55' : '#10222D38';
  addRule(slide, `footer-rule-${pageNumber}`, 72, 676, 1136, rule, 1);
  addText(slide, {
    name: `footer-site-${pageNumber}`,
    text: 'THEAVALANCHEHOUR.COM/SUPPORT',
    left: 72,
    top: 686,
    width: 350,
    height: 18,
    fontSize: 13,
    color,
    bold: true,
    lineSpacing: 1,
  });
  addText(slide, {
    name: `footer-page-${pageNumber}`,
    text: String(pageNumber).padStart(2, '0'),
    left: 1168,
    top: 686,
    width: 40,
    height: 18,
    fontSize: 13,
    color,
    bold: true,
    alignment: 'right',
    lineSpacing: 1,
  });
}

function addNotes(slide, lines) {
  slide.speakerNotes.textFrame.setText([
    '[Sources]',
    ...lines.map((line) => `- ${line}`),
    '[/Sources]',
  ]);
  slide.speakerNotes.setVisible(true);
}

async function addImage(slide, filePath, alt, position, fit = 'fill') {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = extension === '.png' ? 'image/png' : 'image/jpeg';
  return slide.images.add({
    blob: await bytes(filePath),
    contentType,
    alt,
    fit,
    position,
  });
}

function clearSlide(slide) {
  slide.shapes.deleteAll();
  for (const image of [...slide.images.items]) image.delete();
  for (const table of [...slide.tables.items]) table.delete?.();
  for (const chart of [...slide.charts.items]) chart.delete?.();
  for (const artifact of [...slide.artifacts.items]) artifact.delete?.();
}

function addMetric(slide, index, value, label, left, top, width, dark = false) {
  addText(slide, {
    name: `metric-${index}-value`,
    text: value,
    left,
    top,
    width,
    height: 58,
    fontSize: 51,
    color: dark ? C.white : C.ink,
    bold: true,
    lineSpacing: 0.95,
  });
  addText(slide, {
    name: `metric-${index}-label`,
    text: label,
    left,
    top: top + 61,
    width,
    height: 48,
    fontSize: 17,
    color: dark ? '#FFFFFFCE' : C.soft,
    lineSpacing: 1.18,
  });
}

function addValueRow(slide, number, label, copy, top) {
  addText(slide, {
    name: `value-${number}-number`,
    text: number,
    left: 72,
    top: top + 2,
    width: 46,
    height: 26,
    fontSize: 17,
    color: C.signal,
    bold: true,
    lineSpacing: 1,
  });
  addText(slide, {
    name: `value-${number}-label`,
    text: label,
    left: 132,
    top,
    width: 176,
    height: 30,
    fontSize: 23,
    color: C.white,
    bold: true,
    lineSpacing: 1,
  });
  addText(slide, {
    name: `value-${number}-copy`,
    text: copy,
    left: 326,
    top,
    width: 432,
    height: 52,
    fontSize: 18,
    color: '#FFFFFFD6',
    lineSpacing: 1.22,
  });
  addRule(slide, `value-${number}-rule`, 72, top + 61, 686, '#C8E4ED42', 1);
}

async function build() {
  await fs.mkdir(RENDER_DIR, { recursive: true });
  await fs.mkdir(LAYOUT_DIR, { recursive: true });

  const presentation = await PresentationFile.importPptx(await FileBlob.load(STARTER));
  if (presentation.slides.items.length !== 8) {
    throw new Error(`Expected 8 starter slides, found ${presentation.slides.items.length}`);
  }
  for (const slide of presentation.slides.items) clearSlide(slide);

  // 01 — Cover
  {
    const slide = presentation.slides.items[0];
    slide.background.fill = C.deep;
    await addImage(slide, assets.cover, 'Avalanche crown and wind-textured snow', { left: 0, top: 0, width: W, height: H });
    addBox(slide, 'cover-overlay', { left: 0, top: 0, width: W, height: H }, 'linear(0deg, #0B202A/98 0%, #0B202A/87 45%, #0B202A/24 100%)');
    addRule(slide, 'cover-signal-line', 72, 36, 1136, '#EF6F35AA', 3);
    await addImage(slide, assets.logo, 'The Avalanche Hour Podcast logo', { left: 72, top: 54, width: 118, height: 113.3543307087 });
    addEyebrow(slide, 'Independent voices · community supported', 214, 70, 560, C.ice);
    addText(slide, {
      name: 'cover-title',
      text: 'Keep the signal strong.',
      left: 72,
      top: 228,
      width: 1040,
      height: 92,
      fontSize: 76,
      color: C.white,
      typeface: F.display,
      bold: true,
      lineSpacing: 0.86,
    });
    addText(slide, {
      name: 'cover-subtitle',
      text: 'SEASON 11 UNDERWRITING + ADVERTISING',
      left: 76,
      top: 356,
      width: 760,
      height: 36,
      fontSize: 28,
      color: C.white,
      bold: true,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'cover-theme',
      text: 'Finding the Line',
      left: 76,
      top: 414,
      width: 360,
      height: 34,
      fontSize: 25,
      color: C.ice,
      italic: true,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'cover-year-round',
      text: '2026–27 YEAR-ROUND PARTNERSHIPS',
      left: 76,
      top: 470,
      width: 430,
      height: 24,
      fontSize: 18,
      color: C.signal,
      bold: true,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'cover-promise',
      text: 'Put your brand behind the conversations people carry into the field.',
      left: 76,
      top: 526,
      width: 530,
      height: 62,
      fontSize: 23,
      color: '#FFFFFFD4',
      lineSpacing: 1.24,
    });
    addNotes(slide, [
      'User-provided Season 11 underwriting deck, slide 1 (season title, underwriting and advertising framing, and Finding the Line theme).',
      'User clarification on 2026-08-20 that the partnership plan may span the full year.',
      'The Avalanche Hour website avalanche-crown image, retained because the user approved the existing first page.',
    ]);
  }

  // 02 — Audience scale and geography
  {
    const slide = presentation.slides.items[1];
    slide.background.fill = C.snow;
    await addImage(slide, assets.audience, 'Maybird avalanche path above a winter road', { left: 800, top: 0, width: 480, height: 720 });
    addBox(slide, 'audience-photo-overlay', { left: 800, top: 0, width: 480, height: 720 }, 'linear(0deg, #0B202A/92 0%, #0B202A/10 68%, #0B202A/06 100%)');
    addEyebrow(slide, 'Audience proof', 72, 48, 420);
    addTitle(slide, 'A focused audience.\nMeasurable reach.', 72, 82, 660, 108, C.ink, 51);
    addText(slide, {
      name: 'audience-intro',
      text: 'Forecasters, guides, educators, researchers, patrollers, and backcountry travelers meet in one focused conversation.',
      left: 72,
      top: 204,
      width: 650,
      height: 60,
      fontSize: 20,
      color: C.soft,
      lineSpacing: 1.28,
    });
    addRule(slide, 'audience-metric-rule-top', 72, 286, 656, '#10222D38', 1);
    addMetric(slide, 'audience-1', '964K', 'episode plays since October 2016', 72, 308, 184);
    addVRule(slide, 'audience-metric-divider-1', 284, 306, 108, '#10222D38', 1);
    addMetric(slide, 'audience-2', '69K', 'episode plays in the last 12 months', 316, 308, 184);
    addVRule(slide, 'audience-metric-divider-2', 528, 306, 108, '#10222D38', 1);
    addMetric(slide, 'audience-3', '4K', 'plays per episode within three months', 560, 308, 168);
    addText(slide, {
      name: 'geography-heading',
      text: 'WHERE LISTENERS ARE',
      left: 72,
      top: 450,
      width: 360,
      height: 22,
      fontSize: 16,
      color: C.signalDark,
      bold: true,
      lineSpacing: 1,
    });
    const geoX = 72;
    const geoY = 486;
    const geoW = 656;
    const usW = geoW * 0.699;
    const caW = geoW * 0.161;
    const otherW = geoW - usW - caW;
    addBox(slide, 'geography-us', { left: geoX, top: geoY, width: usW, height: 30 }, C.teal);
    addBox(slide, 'geography-canada', { left: geoX + usW, top: geoY, width: caW, height: 30 }, C.signal);
    addBox(slide, 'geography-other', { left: geoX + usW + caW, top: geoY, width: otherW, height: 30 }, C.ice);
    addText(slide, { name: 'geography-us-label', text: 'U.S. 69.9%', left: geoX, top: 528, width: 190, height: 24, fontSize: 18, color: C.ink, bold: true });
    addText(slide, { name: 'geography-canada-label', text: 'CANADA 16.1%', left: 302, top: 528, width: 190, height: 24, fontSize: 18, color: C.signalDark, bold: true });
    addText(slide, { name: 'geography-other-label', text: 'OTHER 14.0%', left: 540, top: 528, width: 188, height: 24, fontSize: 18, color: C.muted, bold: true, alignment: 'right' });
    addText(slide, {
      name: 'geography-other-markets',
      text: 'New Zealand · United Kingdom · Norway · Australia · Japan · beyond',
      left: 72,
      top: 566,
      width: 656,
      height: 42,
      fontSize: 16,
      color: C.muted,
      lineSpacing: 1.18,
    });
    addText(slide, {
      name: 'audience-photo-line',
      text: 'BUILT FOR THE PEOPLE WHO WORK, LEARN, AND TRAVEL IN AVALANCHE TERRAIN.',
      left: 838,
      top: 510,
      width: 370,
      height: 92,
      fontSize: 20,
      color: C.white,
      bold: true,
      lineSpacing: 1.22,
    });
    addText(slide, {
      name: 'audience-photo-note',
      text: 'Metrics reported in Caleb’s source deck.',
      left: 838,
      top: 620,
      width: 360,
      height: 22,
      fontSize: 13,
      color: '#FFFFFFB8',
      lineSpacing: 1,
    });
    addBox(slide, 'audience-footer-band', { left: 0, top: 670, width: W, height: 50 }, '#F4F6F2F2');
    addFooter(slide, 2, false);
    addNotes(slide, [
      'User-provided Season 11 underwriting deck, slide 3 (964K, 69K, 4K, and geographic distribution).',
      'Maybird Path 1.JPG, Google Drive file ID 1r6kjwvBAlTvBVJ8HtwcDA-etmdg1FKXk.',
    ]);
  }

  // 03 — Listener profile
  {
    const slide = presentation.slides.items[2];
    slide.background.fill = C.snow;
    await addImage(slide, assets.profile, 'Avalanche field participant holding an extended probe in deep snow', { left: 850, top: 0, width: 430, height: 720 });
    addBox(slide, 'profile-photo-overlay', { left: 850, top: 0, width: 430, height: 720 }, 'linear(0deg, #0B202A/84 0%, #0B202A/02 56%, #0B202A/00 100%)');
    addEyebrow(slide, 'Listener profile', 72, 44, 420);
    addTitle(slide, 'The core audience is 28–44.', 72, 78, 690, 68, C.ink, 52);
    addText(slide, {
      name: 'profile-intro',
      text: '64.7% of Spotify listeners sit in the 28–44 range—an audience actively shaping mountain culture and professional practice.',
      left: 72,
      top: 154,
      width: 690,
      height: 58,
      fontSize: 19,
      color: C.soft,
      lineSpacing: 1.26,
    });
    addText(slide, { name: 'age-chart-label', text: 'AGE DISTRIBUTION', left: 72, top: 232, width: 280, height: 20, fontSize: 15, color: C.signalDark, bold: true });
    const age = [
      { label: '0–17', value: 0.1 },
      { label: '18–22', value: 1.9 },
      { label: '23–27', value: 11.6 },
      { label: '28–34', value: 33.9, core: true },
      { label: '35–44', value: 30.8, core: true },
      { label: '45–59', value: 15.8 },
      { label: '60+', value: 5.8 },
    ];
    const chartX = 72;
    const baseY = 520;
    const barW = 66;
    const gap = 34;
    const maxH = 210;
    const maxV = 35;
    addRule(slide, 'age-axis', chartX, baseY, 666, '#10222D55', 1);
    for (const [index, point] of age.entries()) {
      const x = chartX + index * (barW + gap);
      const h = Math.max(2, (point.value / maxV) * maxH);
      addBox(slide, `age-bar-${index}`, { left: x, top: baseY - h, width: barW, height: h }, point.core ? C.signal : C.teal);
      addText(slide, {
        name: `age-value-${index}`,
        text: `${point.value.toFixed(1)}%`,
        left: x - 8,
        top: baseY - h - 24,
        width: barW + 16,
        height: 20,
        fontSize: 14,
        color: point.core ? C.signalDark : C.ink,
        bold: true,
        alignment: 'center',
        lineSpacing: 1,
      });
      addText(slide, {
        name: `age-label-${index}`,
        text: point.label,
        left: x - 8,
        top: baseY + 10,
        width: barW + 16,
        height: 20,
        fontSize: 14,
        color: C.muted,
        alignment: 'center',
        lineSpacing: 1,
      });
    }
    addText(slide, { name: 'gender-chart-label', text: 'GENDER', left: 72, top: 566, width: 120, height: 20, fontSize: 15, color: C.signalDark, bold: true });
    const genderX = 178;
    const genderY = 565;
    const genderW = 560;
    const maleW = genderW * 0.783;
    const femaleW = genderW * 0.183;
    const nonBinaryW = genderW * 0.007;
    const unspecifiedW = genderW - maleW - femaleW - nonBinaryW;
    addBox(slide, 'gender-male', { left: genderX, top: genderY, width: maleW, height: 20 }, C.teal);
    addBox(slide, 'gender-female', { left: genderX + maleW, top: genderY, width: femaleW, height: 20 }, C.signal);
    addBox(slide, 'gender-nonbinary', { left: genderX + maleW + femaleW, top: genderY, width: nonBinaryW, height: 20 }, '#7FAEBB');
    addBox(slide, 'gender-unspecified', { left: genderX + maleW + femaleW + nonBinaryW, top: genderY, width: unspecifiedW, height: 20 }, C.line);
    const genderLegend = [
      { x: 72, color: C.teal, text: 'MALE 78.3%' },
      { x: 252, color: C.signal, text: 'FEMALE 18.3%' },
      { x: 448, color: '#7FAEBB', text: 'NON-BINARY 0.7%' },
      { x: 650, color: C.line, text: 'NOT SPECIFIED 2.7%' },
    ];
    for (const [index, item] of genderLegend.entries()) {
      addBox(slide, `gender-key-${index}`, { left: item.x, top: 606, width: 11, height: 11 }, item.color);
      addText(slide, { name: `gender-key-label-${index}`, text: item.text, left: item.x + 18, top: 601, width: 176, height: 22, fontSize: 13, color: C.muted, bold: true, lineSpacing: 1 });
    }
    addText(slide, {
      name: 'profile-photo-caption',
      text: 'A field-earned audience\nwith technical depth.',
      left: 892,
      top: 558,
      width: 320,
      height: 70,
      fontSize: 22,
      color: C.white,
      bold: true,
      lineSpacing: 1.18,
    });
    addBox(slide, 'profile-footer-band', { left: 0, top: 670, width: W, height: 50 }, '#F4F6F2F2');
    addFooter(slide, 3, false);
    addNotes(slide, [
      'User-provided Season 11 underwriting deck, slide 3 (age and gender distributions).',
      'IMG_1204.jpg, Google Drive file ID 1KrvFYfV5DQSIMR3FnKRTdAuANYURik9i.',
    ]);
  }

  // 04 — Momentum metrics
  {
    const slide = presentation.slides.items[3];
    slide.background.fill = C.deep;
    await addImage(slide, assets.momentum, 'Wet-slab avalanche debris below a broken crown', { left: 0, top: 0, width: W, height: H });
    addBox(slide, 'momentum-photo-overlay', { left: 0, top: 0, width: W, height: H }, 'linear(0deg, #0B202A/96 0%, #0B202A/79 58%, #0B202A/66 100%)');
    addEyebrow(slide, 'Audience momentum', 72, 48, 440, C.ice);
    addTitle(slide, 'Reach that keeps moving.', 72, 82, 900, 72, C.white, 56);
    addText(slide, {
      name: 'momentum-intro',
      text: 'The source deck reports meaningful growth across listening and social discovery.',
      left: 72,
      top: 166,
      width: 760,
      height: 40,
      fontSize: 21,
      color: '#FFFFFFD1',
      lineSpacing: 1.24,
    });
    const metrics = [
      { value: '44%', label: 'LISTENER-BASE INCREASE', detail: 'Reported from the Season 9, 2024–25 winter-season baseline.' },
      { value: '+1,500', label: 'NEW INSTAGRAM FOLLOWERS', detail: 'Reported across the latest 12-month period in Caleb’s deck.' },
      { value: '77K+', label: 'LISTENERS REACHED', detail: 'Reported all-time reach in the source audience graphic.' },
    ];
    metrics.forEach((metric, index) => {
      const x = 72 + index * 376;
      addBox(slide, `momentum-surface-${index}`, { left: x, top: 254, width: 342, height: 266 }, 'none', { style: 'solid', fill: '#C8E4ED66', width: 1 });
      addBox(slide, `momentum-accent-${index}`, { left: x, top: 254, width: 342, height: 7 }, C.signal);
      addText(slide, { name: `momentum-value-${index}`, text: metric.value, left: x + 28, top: 292, width: 286, height: 74, fontSize: 62, color: C.white, bold: true, lineSpacing: 0.92 });
      addText(slide, { name: `momentum-label-${index}`, text: metric.label, left: x + 28, top: 382, width: 286, height: 46, fontSize: 18, color: C.ice, bold: true, lineSpacing: 1.1 });
      addText(slide, { name: `momentum-detail-${index}`, text: metric.detail, left: x + 28, top: 444, width: 286, height: 62, fontSize: 16, color: '#FFFFFFC4', lineSpacing: 1.22 });
    });
    addText(slide, {
      name: 'momentum-source-note',
      text: 'As reported in the source deck. Platform periods, definitions, and counting methods vary.',
      left: 72,
      top: 622,
      width: 920,
      height: 24,
      fontSize: 14,
      color: '#FFFFFFAE',
      lineSpacing: 1,
    });
    addFooter(slide, 4, true);
    addNotes(slide, [
      'User-provided Season 11 underwriting deck, slide 3 (44% listener-base increase, 1,500 new Instagram followers, and 77K+ listeners reached).',
      'Wet slab&cornice debris_SZW.JPG, Google Drive file ID 1DWZ7Ld0Rst_iX3bA0lP6vieK_HWLYzKt.',
    ]);
  }

  // 05 — Full-year cadence
  {
    const slide = presentation.slides.items[4];
    slide.background.fill = C.deep;
    await addImage(slide, assets.cadence, 'Skier making a powder turn through a snow-covered forest', { left: 0, top: 0, width: W, height: H });
    addBox(slide, 'cadence-photo-overlay', { left: 0, top: 0, width: W, height: H }, 'linear(0deg, #0B202A/97 0%, #0B202A/79 56%, #0B202A/47 100%)');
    addEyebrow(slide, 'Year-round programming', 72, 48, 480, C.ice);
    addTitle(slide, '38 releases keep the signal active.', 72, 82, 1040, 64, C.white, 50);
    addBox(slide, 'cadence-equation-surface', { left: 72, top: 190, width: 756, height: 218 }, 'none', { style: 'solid', fill: '#C8E4ED66', width: 1 });
    addText(slide, { name: 'cadence-29', text: '29', left: 104, top: 224, width: 150, height: 82, fontSize: 78, color: C.white, bold: true, lineSpacing: 0.9 });
    addText(slide, { name: 'cadence-29-label', text: 'REGULAR\nCONVERSATIONS', left: 104, top: 316, width: 170, height: 52, fontSize: 17, color: C.ice, bold: true, lineSpacing: 1.08 });
    addText(slide, { name: 'cadence-plus', text: '+', left: 282, top: 242, width: 58, height: 60, fontSize: 50, color: C.signal, bold: true, alignment: 'center', lineSpacing: 1 });
    addText(slide, { name: 'cadence-9', text: '9', left: 374, top: 224, width: 100, height: 82, fontSize: 78, color: C.signal, bold: true, lineSpacing: 0.9 });
    addText(slide, { name: 'cadence-9-label', text: 'SLABS ’N SLUFFS\nEPISODES', left: 374, top: 316, width: 174, height: 52, fontSize: 17, color: C.ice, bold: true, lineSpacing: 1.08 });
    addText(slide, { name: 'cadence-equals', text: '=', left: 552, top: 242, width: 58, height: 60, fontSize: 50, color: C.ice, bold: true, alignment: 'center', lineSpacing: 1 });
    addText(slide, { name: 'cadence-38', text: '38', left: 636, top: 224, width: 146, height: 82, fontSize: 78, color: C.white, bold: true, lineSpacing: 0.9 });
    addText(slide, { name: 'cadence-38-label', text: 'PLANNED\nRELEASES', left: 636, top: 316, width: 146, height: 52, fontSize: 17, color: C.ice, bold: true, lineSpacing: 1.08 });
    const blockX = 72;
    const blockY = 456;
    const blockW = 16;
    const blockGap = 4;
    for (let index = 0; index < 38; index += 1) {
      addBox(slide, `release-block-${index + 1}`, { left: blockX + index * (blockW + blockGap), top: blockY, width: blockW, height: 20 }, index < 29 ? C.teal : C.signal, { style: 'solid', fill: '#FFFFFF55', width: 0.5 });
    }
    addText(slide, { name: 'release-regular-label', text: '29 REGULAR CONVERSATIONS', left: 72, top: 490, width: 310, height: 22, fontSize: 15, color: C.ice, bold: true });
    addText(slide, { name: 'release-slabs-label', text: '9 SLABS ’N SLUFFS', left: 586, top: 490, width: 242, height: 22, fontSize: 15, color: C.signal, bold: true, alignment: 'right' });
    addText(slide, {
      name: 'cadence-right-heading',
      text: 'A YEAR-ROUND WINDOW',
      left: 884,
      top: 204,
      width: 300,
      height: 24,
      fontSize: 17,
      color: C.signal,
      bold: true,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'cadence-right-copy',
      text: 'Almost weekly, with selected weeks carrying a second release.',
      left: 884,
      top: 246,
      width: 314,
      height: 132,
      fontSize: 27,
      color: C.white,
      bold: true,
      lineSpacing: 1.13,
    });
    addRule(slide, 'cadence-right-rule', 884, 406, 110, C.signal, 5);
    addText(slide, {
      name: 'cadence-25',
      text: '25+',
      left: 884,
      top: 434,
      width: 150,
      height: 58,
      fontSize: 50,
      color: C.white,
      bold: true,
      lineSpacing: 0.95,
    });
    addText(slide, {
      name: 'cadence-25-copy',
      text: 'episode acknowledgements included at the Partner level',
      left: 884,
      top: 504,
      width: 292,
      height: 74,
      fontSize: 19,
      color: '#FFFFFFCE',
      lineSpacing: 1.22,
    });
    addFooter(slide, 5, true);
    addNotes(slide, [
      'User clarification on 2026-08-20 that the plan may span a full year, with 38 releases, nearly weekly and selected second-release weeks.',
      'User-provided Season 11 underwriting deck, slide 2 (9 Slabs ’n Sluffs episodes) and slide 4 (25+ Partner acknowledgements).',
      'Powder-skier photograph embedded in the user-provided Season 11 underwriting deck, slide 1 (ppt/media/image2.jpeg).',
    ]);
  }

  // 06 — Support options
  {
    const slide = presentation.slides.items[5];
    slide.background.fill = C.snow;
    addBox(slide, 'support-top-accent', { left: 0, top: 0, width: W, height: 14 }, C.signal);
    addEyebrow(slide, 'Support options', 72, 48, 420);
    addTitle(slide, 'Choose the level that fits.', 72, 82, 960, 70, C.ink, 56);
    addText(slide, {
      name: 'support-intro',
      text: 'From one focused episode to a season-long or year-round relationship.',
      left: 72,
      top: 162,
      width: 860,
      height: 34,
      fontSize: 20,
      color: C.soft,
      lineSpacing: 1.2,
    });
    const columns = [
      {
        name: 'FRIEND',
        kicker: 'SINGLE EPISODE',
        price: '$500',
        unit: '/ episode',
        bullets: ['1–2 minute mid-episode message', 'Intro or outro acknowledgement', 'Social post + website logo'],
      },
      {
        name: 'PARTNER',
        kicker: 'SEASON-LONG',
        price: '$4,000',
        unit: '/ season',
        bullets: ['Season-long support', '10–15 minutes per season for a representative', 'Acknowledgement on 25+ episodes', 'Social post + website logo'],
      },
      {
        name: 'LEGACY',
        kicker: 'DEEPER ALIGNMENT',
        price: '$6,000',
        unit: '/ season',
        bullets: ['Season-long support that helps grow the podcast', 'Designed for deeper, ongoing alignment'],
      },
      {
        name: 'SLABS ’N SLUFFS',
        kicker: 'RECAP SHOW',
        price: '$5,000+',
        unit: '/ season',
        bullets: ['Extended representative access', 'Guest or topic selection opportunities', 'Custom collaboration options'],
      },
    ];
    const startX = 72;
    const gap = 18;
    const colW = 270;
    columns.forEach((column, index) => {
      const x = startX + index * (colW + gap);
      addBox(slide, `support-card-${index}`, { left: x, top: 222, width: colW, height: 370 }, 'none', { style: 'solid', fill: '#10222D38', width: 1 });
      addBox(slide, `support-card-accent-${index}`, { left: x, top: 222, width: colW, height: 7 }, index === 1 ? C.signal : C.teal);
      addText(slide, { name: `support-kicker-${index}`, text: column.kicker, left: x + 22, top: 250, width: colW - 44, height: 20, fontSize: 14, color: C.signalDark, bold: true, lineSpacing: 1 });
      addText(slide, { name: `support-name-${index}`, text: column.name, left: x + 22, top: 280, width: colW - 44, height: 38, fontSize: 25, color: C.ink, bold: true, lineSpacing: 1 });
      addText(slide, { name: `support-price-${index}`, text: column.price, left: x + 22, top: 328, width: colW - 44, height: 48, fontSize: 38, color: C.ink, bold: true, lineSpacing: 1 });
      addText(slide, { name: `support-unit-${index}`, text: column.unit, left: x + 22, top: 374, width: colW - 44, height: 24, fontSize: 17, color: C.muted, lineSpacing: 1 });
      addRule(slide, `support-rule-${index}`, x + 22, 416, colW - 44, '#10222D38', 1);
      addText(slide, {
        name: `support-bullets-${index}`,
        text: column.bullets.map((bullet) => `• ${bullet}`).join('\n'),
        left: x + 22,
        top: 438,
        width: colW - 44,
        height: 136,
        fontSize: 16,
        color: C.soft,
        lineSpacing: 1.16,
      });
    });
    addBox(slide, 'support-note-band', { left: 72, top: 608, width: 1134, height: 44 }, 'none', { style: 'solid', fill: '#10222D38', width: 1 });
    addText(slide, {
      name: 'support-note',
      text: 'Custom packages are available. Guest or topic proposals remain subject to editorial approval.',
      left: 92,
      top: 620,
      width: 1094,
      height: 22,
      fontSize: 16,
      color: C.ink,
      bold: true,
      lineSpacing: 1,
    });
    addFooter(slide, 6, false);
    addNotes(slide, [
      'User-provided Season 11 underwriting deck, slide 4 (package names, prices, and listed benefits).',
      'User clarification on 2026-08-20 that Caleb’s source deck is the factual authority for this guide.',
    ]);
  }

  // 07 — Value and testimonial
  {
    const slide = presentation.slides.items[6];
    slide.background.fill = C.deep;
    await addImage(slide, assets.value, 'Skier moving through deep powder in storm conditions', { left: 0, top: 0, width: W, height: H });
    addBox(slide, 'value-photo-overlay', { left: 0, top: 0, width: W, height: H }, 'linear(90deg, #0B202A/99 0%, #0B202A/92 57%, #0B202A/32 100%)');
    addEyebrow(slide, 'What partnership delivers', 72, 44, 520, C.ice);
    addTitle(slide, 'Recognition that respects the audience.', 72, 78, 1030, 58, C.white, 44);
    addText(slide, {
      name: 'value-intro',
      text: 'Useful visibility, real access, and a credible place inside the avalanche conversation.',
      left: 72,
      top: 150,
      width: 720,
      height: 38,
      fontSize: 20,
      color: '#FFFFFFD1',
      lineSpacing: 1.2,
    });
    addValueRow(slide, '01', 'Authentic reach', 'Connect with people already engaged in avalanche education, professional practice, and backcountry culture.', 220);
    addValueRow(slide, '02', 'Brand visibility', 'Episode acknowledgements, social promotion, website placement, and recurring season-long presence.', 306);
    addValueRow(slide, '03', 'Credibility', 'Associate with an established, community-focused voice in the avalanche world.', 392);
    addValueRow(slide, '04', 'Access', 'Representative access and guest or topic proposals, subject to editorial approval.', 478);
    addBox(slide, 'testimonial-surface', { left: 842, top: 236, width: 366, height: 330 }, '#10222DE8', { style: 'solid', fill: '#C8E4ED66', width: 1 });
    addCircle(slide, 'testimonial-mark', { left: 874, top: 264, width: 42, height: 42 }, C.signal);
    addText(slide, { name: 'testimonial-quote-mark', text: '“', left: 882, top: 260, width: 28, height: 38, fontSize: 36, color: C.white, bold: true, alignment: 'center', lineSpacing: 1 });
    addText(slide, {
      name: 'testimonial-quote',
      text: 'Advertising on The Avalanche Hour has been an incredible way for us to connect with the core snow and avalanche community.',
      left: 874,
      top: 326,
      width: 302,
      height: 132,
      fontSize: 18,
      color: C.white,
      italic: true,
      lineSpacing: 1.2,
    });
    addRule(slide, 'testimonial-rule', 874, 476, 86, C.signal, 4);
    addText(slide, {
      name: 'testimonial-name',
      text: 'GARRETT HARMSEN\nCO-FOUNDER · PROPAGATION LABS',
      left: 874,
      top: 500,
      width: 302,
      height: 44,
      fontSize: 14,
      color: C.ice,
      bold: true,
      lineSpacing: 1.18,
    });
    addFooter(slide, 7, true);
    addNotes(slide, [
      'User-provided Season 11 underwriting deck, slide 5 (authentic reach, brand visibility, credibility, and access framework).',
      'User-provided Season 11 underwriting deck, slide 2 (Propagation Labs testimonial; excerpt reproduced).',
      '200117 Snowbird Sean Z EDITED (6 of 10).jpg, Google Drive file ID 192y0Tsf_apOYh_H78aYztEhiLLiEwAvt.',
    ]);
  }

  // 08 — Contact
  {
    const slide = presentation.slides.items[7];
    slide.background.fill = C.deep;
    await addImage(slide, assets.close, 'Snow-covered mountain terrain viewed from a helicopter cockpit', { left: 0, top: 0, width: W, height: H });
    addBox(slide, 'close-photo-overlay', { left: 0, top: 0, width: W, height: H }, 'linear(90deg, #0B202A/98 0%, #0B202A/86 48%, #0B202A/12 100%)');
    await addImage(slide, assets.logo, 'The Avalanche Hour Podcast logo', { left: 72, top: 50, width: 118, height: 113.3543307087 });
    addEyebrow(slide, 'Start a conversation', 214, 68, 430, C.ice);
    addTitle(slide, 'Let’s build the right fit.', 72, 222, 690, 88, C.white, 64);
    addText(slide, {
      name: 'close-body',
      text: 'If one of the standard options is close—but not quite right—we can shape a custom underwriting or advertising package around your goals.',
      left: 72,
      top: 330,
      width: 594,
      height: 92,
      fontSize: 22,
      color: '#FFFFFFD1',
      lineSpacing: 1.28,
    });
    addRule(slide, 'close-signal-rule', 72, 450, 108, C.signal, 5);
    addText(slide, {
      name: 'close-contact',
      text: 'theavalanchehourpodcast@gmail.com\ntheavalanchehour.com/support\n@theavalanchehourpodcast',
      left: 72,
      top: 478,
      width: 610,
      height: 110,
      fontSize: 21,
      color: C.white,
      bold: true,
      lineSpacing: 1.4,
    });
    addText(slide, {
      name: 'close-year-round',
      text: 'SEASON 11  ·  2026–27 YEAR-ROUND PARTNERSHIPS',
      left: 72,
      top: 620,
      width: 520,
      height: 24,
      fontSize: 16,
      color: C.signal,
      bold: true,
      lineSpacing: 1,
    });
    addFooter(slide, 8, true);
    addNotes(slide, [
      'User-provided Season 11 underwriting deck, slide 6 (contact details and custom-package invitation).',
      'The current website contact handle and support URL are used for link accuracy.',
      'Helicopter cockpit and mountain photograph embedded in the user-provided Season 11 underwriting deck, slide 6 (ppt/media/image10.jpeg).',
    ]);
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, '0')}`;
    await writeBlob(path.join(RENDER_DIR, `${stem}.png`), await presentation.export({ slide, format: 'png', scale: 1.4 }));
    const layout = await slide.export({ format: 'layout' });
    await fs.writeFile(path.join(LAYOUT_DIR, `${stem}.layout.json`), await layout.text());
  }

  await writeBlob(path.join(TMP, 'final-montage.webp'), await presentation.export({ format: 'webp', montage: true, scale: 1 }));
  const snapshot = await presentation.inspect({
    kind: 'slide,textbox,shape,image,notes',
    include: 'id,slide,name,title,textPreview,bbox,bboxUnit,alt',
    maxChars: 90000,
  });
  await fs.writeFile(path.join(TMP, 'final-inspect.ndjson'), snapshot.ndjson);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT);
  console.log(OUT);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
