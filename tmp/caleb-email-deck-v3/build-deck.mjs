import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT = '/Users/camerongriffin/projects/TheAvalancheHour';
const TMP = path.join(ROOT, 'tmp/caleb-email-deck-v3');
const ASSETS = path.join(TMP, 'source-assets');
const RENDER_DIR = path.join(TMP, 'final-render');
const LAYOUT_DIR = path.join(TMP, 'final-layout');
const OUT = path.join(ROOT, 'public/files/avalanche-hour-season-11-partnership-deck.pptx');

const W = 1280;
const H = 720;

const C = {
  ink: '#10222D',
  deep: '#0B202A',
  snow: '#F4F6F2',
  paper: '#F8F5ED',
  white: '#FFFFFF',
  ice: '#DCE9E9',
  iceStrong: '#C8E4ED',
  blue: '#7EA2C4',
  blueDark: '#2F6794',
  orange: '#B9471D',
  signal: '#EF6F35',
  violet: '#6B45FF',
  muted: '#526A75',
  line: '#AEBCC1',
};

const F = {
  display: 'Bebas Neue',
  hand: 'Amatic SC',
  body: 'Helvetica Neue',
  fallback: 'Arial',
  serif: 'Georgia',
};

const asset = (name) => path.join(ASSETS, name);

const A = {
  hero: asset('01-hero.jpg'),
  artwork: asset('03-artwork.png'),
  mountain: asset('06-banner.jpg'),
  slabs: asset('08-square.jpg'),
  hosts: asset('09-host.jpg'),
  close: asset('10-banner.jpg'),
  instagram: asset('12-instagram.png'),
  austinPowder: path.join(ROOT, 'public/images/sponsors/AustinPowder.png'),
  propagationLabs: path.join(ROOT, 'public/images/sponsors/prop_labs.jpg'),
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

function addInstagramMark(slide, left, top, size, color = C.iceStrong) {
  slide.shapes.add({
    geometry: 'roundRect',
    name: 'instagram-mark-frame',
    position: { left, top, width: size, height: size },
    fill: 'none',
    line: { style: 'solid', fill: color, width: 2.4 },
  });
  slide.shapes.add({
    geometry: 'ellipse',
    name: 'instagram-mark-lens',
    position: { left: left + size * 0.25, top: top + size * 0.25, width: size * 0.5, height: size * 0.5 },
    fill: 'none',
    line: { style: 'solid', fill: color, width: 2.4 },
  });
  slide.shapes.add({
    geometry: 'ellipse',
    name: 'instagram-mark-dot',
    position: { left: left + size * 0.71, top: top + size * 0.17, width: size * 0.1, height: size * 0.1 },
    fill: color,
    line: { style: 'solid', fill: color, width: 0 },
  });
}

function addText(slide, {
  name,
  text,
  left,
  top,
  width,
  height,
  fontSize = 22,
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

function addEyebrow(slide, text, left, top, width, color = C.orange) {
  return addText(slide, {
    name: `eyebrow-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    text: text.toUpperCase(),
    left,
    top,
    width,
    height: 24,
    fontSize: 16,
    color,
    typeface: F.body,
    bold: true,
    lineSpacing: 1,
  });
}

function addTitle(slide, text, left, top, width, height, color = C.ink, fontSize = 50) {
  return addText(slide, {
    name: 'slide-title',
    text,
    left,
    top,
    width,
    height,
    fontSize,
    color,
    typeface: F.display,
    bold: false,
    lineSpacing: 0.94,
  });
}

function addFooter(slide, pageNumber, dark = false) {
  const textColor = dark ? '#DDE8EB' : C.muted;
  const ruleColor = dark ? '#49606A' : '#BCC8CB';
  addRule(slide, `footer-rule-${pageNumber}`, 56, 678, 1168, ruleColor, 1);
  addText(slide, {
    name: `footer-site-${pageNumber}`,
    text: 'THEAVALANCHEHOUR.COM/SUPPORT',
    left: 56,
    top: 688,
    width: 360,
    height: 16,
    fontSize: 12,
    color: textColor,
    bold: true,
    lineSpacing: 1,
  });
  addText(slide, {
    name: `footer-page-${pageNumber}`,
    text: String(pageNumber).padStart(2, '0'),
    left: 1170,
    top: 688,
    width: 54,
    height: 16,
    fontSize: 12,
    color: textColor,
    bold: true,
    alignment: 'right',
    lineSpacing: 1,
  });
}

function addHostNameColumn(slide, names, { left, top, width, height, columnName, fontSize = 19 }) {
  const rowHeight = height / names.length;

  names.forEach((hostName, index) => {
    const rowTop = top + rowHeight * index;
    addText(slide, {
      name: `host-${columnName}-${index + 1}`,
      text: hostName,
      left,
      top: rowTop + 4,
      width,
      height: rowHeight - 8,
      fontSize,
      color: C.white,
      typeface: F.display,
      verticalAlignment: 'middle',
      lineSpacing: 1,
    });

    if (index < names.length - 1) {
      addRule(
        slide,
        `host-${columnName}-${index + 1}-divider`,
        left,
        rowTop + rowHeight,
        width,
        '#304955',
        0.75,
      );
    }
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

async function addImage(slide, filePath, alt, position) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = extension === '.png' ? 'image/png' : 'image/jpeg';
  return slide.images.add({
    blob: await bytes(filePath),
    contentType,
    alt,
    fit: 'contain',
    position,
  });
}

function addMetric(slide, value, label, left, top, width) {
  addText(slide, {
    name: `metric-${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-value`,
    text: value,
    left,
    top,
    width,
    height: 58,
    fontSize: 54,
    color: C.ink,
    typeface: F.display,
    lineSpacing: 0.95,
  });
  addText(slide, {
    name: `metric-${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-label`,
    text: label,
    left,
    top: top + 60,
    width,
    height: 62,
    fontSize: 17,
    color: C.muted,
    bold: true,
    lineSpacing: 1.15,
  });
}

function addPackageLane(slide, { name, price, detail, left, width }) {
  addText(slide, {
    name: `package-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-name`,
    text: name.toUpperCase(),
    left,
    top: 220,
    width,
    height: 32,
    fontSize: 24,
    color: C.orange,
    typeface: F.display,
    lineSpacing: 1,
  });
  addText(slide, {
    name: `package-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-price`,
    text: price.replace(' / ', '\n/ '),
    left,
    top: 260,
    width,
    height: 68,
    fontSize: 31,
    color: C.ink,
    typeface: F.display,
    lineSpacing: 0.94,
  });
  addRule(slide, `package-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-rule`, left, 338, 76, C.signal, 4);
  addText(slide, {
    name: `package-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-detail`,
    text: detail,
    left,
    top: 358,
    width,
    height: 232,
    fontSize: 18,
    color: C.ink,
    lineSpacing: 1.35,
  });
}

async function build() {
  await fs.mkdir(RENDER_DIR, { recursive: true });
  await fs.mkdir(LAYOUT_DIR, { recursive: true });

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  // 01 — Cover
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.deep;
    await addImage(slide, A.hero, 'Season 11 Finding the Line powder-skier poster from Caleb’s partnership email', {
      left: 0,
      top: 0,
      width: 647.19,
      height: 720,
    });
    addBox(slide, 'cover-season-source-typo-mask', { left: 260, top: 286, width: 154, height: 38 }, C.deep);
    addText(slide, {
      name: 'cover-season-corrected',
      text: 'SEASON 11',
      left: 270,
      top: 296,
      width: 134,
      height: 18,
      fontSize: 14,
      color: C.white,
      bold: true,
      alignment: 'center',
      lineSpacing: 1,
    });
    addRule(slide, 'cover-season-corrected-rule', 260, 324, 154, C.signal, 3);
    addEyebrow(slide, 'Season 11 sponsorship deck', 708, 78, 450, C.iceStrong);
    addRule(slide, 'cover-signal-rule', 708, 118, 96, C.signal, 5);
    addTitle(slide, 'Partnership +\nUnderwriting', 708, 154, 500, 154, C.white, 66);
    addText(slide, {
      name: 'cover-subtitle',
      text: 'Year-round opportunities to support independent avalanche storytelling.',
      left: 708,
      top: 334,
      width: 470,
      height: 80,
      fontSize: 25,
      color: C.iceStrong,
      lineSpacing: 1.22,
    });
    addText(slide, {
      name: 'cover-cadence',
      text: '38 planned releases\nNearly weekly · selected two-release weeks',
      left: 708,
      top: 470,
      width: 470,
      height: 78,
      fontSize: 20,
      color: C.white,
      bold: true,
      lineSpacing: 1.35,
    });
    addText(slide, {
      name: 'cover-url',
      text: 'THEAVALANCHEHOUR.COM/SUPPORT',
      left: 708,
      top: 644,
      width: 470,
      height: 22,
      fontSize: 15,
      color: C.signal,
      bold: true,
      lineSpacing: 1,
    });
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026 (cover artwork and visual direction).',
      'User-provided planning context, August 20, 2026 (year-round window, nearly weekly cadence, selected two-release weeks, 38 planned releases).',
    ]);
  }

  // 02 — Show purpose and cadence
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.snow;
    addEyebrow(slide, 'Independent voices · community supported', 64, 42, 650, C.orange);
    addTitle(slide, 'Stories, knowledge,\nand hard-earned lessons.', 64, 72, 820, 96, C.ink, 44);
    addText(slide, {
      name: 'purpose-body',
      text: 'The Avalanche Hour is built around the people, decisions, and lived experience that shape the snow and avalanche community.',
      left: 64,
      top: 174,
      width: 820,
      height: 42,
      fontSize: 18,
      color: C.muted,
      lineSpacing: 1.24,
    });
    addText(slide, {
      name: 'purpose-cadence-number',
      text: '29 + 9',
      left: 982,
      top: 66,
      width: 230,
      height: 56,
      fontSize: 50,
      color: C.orange,
      typeface: F.display,
      alignment: 'right',
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'purpose-cadence-label',
      text: 'regular episodes +\nSlabs ’n Sluffs releases',
      left: 952,
      top: 126,
      width: 260,
      height: 48,
      fontSize: 16,
      color: C.ink,
      bold: true,
      alignment: 'right',
      lineSpacing: 1.25,
    });
    await addImage(slide, A.artwork, 'Hand-drawn Avalanche Hour mountain, snowmobile, ski, and helicopter artwork', {
      left: 138,
      top: 234,
      width: 1004,
      height: 486.1,
    });
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026 (hand-drawn show artwork and show description).',
      'Season 11 planning source, lib/season11MastermindSchedule.mjs, and user-provided planning context (29 regular releases + 9 Slabs ’n Sluffs releases).',
    ]);
  }

  // 03 — Reach
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.paper;
    await addImage(slide, A.mountain, 'Two people travelling below a snow-covered mountain, framed by Caleb’s blue wave treatment', {
      left: 40,
      top: 0,
      width: 1200,
      height: 360,
    });
    addBox(slide, 'reach-title-band', { left: 0, top: 0, width: 1280, height: 94 }, C.deep);
    addEyebrow(slide, 'Audience reach', 64, 24, 300, C.iceStrong);
    addTitle(slide, 'A decade of listening has built measurable reach.', 64, 48, 980, 48, C.white, 43);
    addMetric(slide, '964K', 'EPISODE PLAYS\nSINCE OCTOBER 2016', 72, 405, 230);
    addMetric(slide, '69K', 'EPISODE PLAYS\nIN THE LAST 12 MONTHS', 366, 405, 230);
    addMetric(slide, '4K', 'PLAYS / DOWNLOADS\nPER EPISODE\nWITHIN FIRST 3 MONTHS', 660, 405, 230);
    addMetric(slide, '44%', 'LISTENER-BASE GROWTH\nSINCE SEASON 9', 954, 405, 230);
    addText(slide, {
      name: 'reach-secondary-metrics',
      text: '1,500 NEW INSTAGRAM FOLLOWERS IN 12 MONTHS    ·    77K+ ALL-TIME LISTENERS REACHED',
      left: 72,
      top: 628,
      width: 1136,
      height: 24,
      fontSize: 16,
      color: C.orange,
      bold: true,
      alignment: 'center',
      lineSpacing: 1,
    });
    addFooter(slide, 3, false);
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026 (mountain banner and audience infographic).',
      'Audience metrics transcribed from the email infographic: 964K plays since October 2016; 69K plays in 12 months; 4K plays/downloads per episode within three months; 44% growth since Season 9; 1,500 new Instagram followers; 77K+ all-time listeners reached.',
    ]);
  }

  // 04 — Demographics
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.snow;
    addEyebrow(slide, 'Audience snapshot', 64, 40, 340, C.orange);
    addTitle(slide, 'The audience is established—and the show is\nbroadening who gets heard.', 64, 70, 1120, 100, C.ink, 42);
    addText(slide, {
      name: 'demographics-intro',
      text: 'Current reporting still skews male. The host team, guests, and stories are intentionally expanding representation across the industry.',
      left: 64,
      top: 174,
      width: 1110,
      height: 46,
      fontSize: 19,
      color: C.muted,
      lineSpacing: 1.2,
    });
    addText(slide, {
      name: 'gender-chart-label',
      text: 'GENDER REPORTING',
      left: 76,
      top: 226,
      width: 360,
      height: 24,
      fontSize: 17,
      color: C.ink,
      bold: true,
      lineSpacing: 1,
    });
    slide.charts.add('doughnut', {
      position: { left: 54, top: 252, width: 410, height: 316 },
      categories: ['Male', 'Female', 'Non-binary', 'Not specified'],
      series: [{
        name: 'Audience share',
        values: [78.3, 18.3, 0.7, 2.7],
        points: [
          { idx: 0, fill: C.ink },
          { idx: 1, fill: C.violet },
          { idx: 2, fill: C.signal },
          { idx: 3, fill: C.iceStrong },
        ],
      }],
      doughnutOptions: { holeSize: 62, firstSliceAngle: 270 },
      hasLegend: true,
      legend: { position: 'bottom', overlay: false, textStyle: { fill: C.muted, fontSize: 12 } },
      chartFill: 'none',
      chartLine: { style: 'solid', fill: 'none', width: 0 },
      plotAreaFill: 'none',
      plotAreaLine: { style: 'solid', fill: 'none', width: 0 },
    });
    addText(slide, {
      name: 'gender-center-label',
      text: '78.3%\nMALE',
      left: 166,
      top: 342,
      width: 184,
      height: 62,
      fontSize: 27,
      color: C.ink,
      typeface: F.display,
      alignment: 'center',
      lineSpacing: 0.95,
    });
    addText(slide, {
      name: 'gender-minority-breakout',
      text: 'FEMALE 18.3%  ·  NON-BINARY 0.7%  ·  NOT SPECIFIED 2.7%',
      left: 54,
      top: 568,
      width: 410,
      height: 18,
      fontSize: 10,
      color: C.muted,
      bold: true,
      alignment: 'center',
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'age-chart-label',
      text: 'AGE DISTRIBUTION',
      left: 520,
      top: 226,
      width: 660,
      height: 24,
      fontSize: 17,
      color: C.ink,
      bold: true,
      lineSpacing: 1,
    });
    const ageValues = [0.1, 1.9, 11.6, 33.9, 30.8, 15.8, 5.8, 0];
    const ageLabels = ['0–17', '18–22', '23–27', '28–34', '35–44', '45–59', '60+', 'Unknown'];
    const chartLeft = 546;
    const chartTop = 270;
    const chartWidth = 620;
    const chartHeight = 258;
    const plotBottom = chartTop + chartHeight;
    for (const tick of [0, 10, 20, 30, 40]) {
      const y = plotBottom - (tick / 40) * chartHeight;
      addRule(slide, `age-grid-${tick}`, chartLeft, y, chartWidth, tick === 0 ? C.line : '#D8E0E1', 1);
      addText(slide, {
        name: `age-y-label-${tick}`,
        text: `${tick}%`,
        left: 502,
        top: y - 8,
        width: 36,
        height: 16,
        fontSize: 11,
        color: C.muted,
        alignment: 'right',
        lineSpacing: 1,
      });
    }
    const barSlot = chartWidth / ageValues.length;
    ageValues.forEach((value, index) => {
      const barWidth = 54;
      const barHeight = Math.max(1.5, (value / 40) * chartHeight);
      const left = chartLeft + index * barSlot + (barSlot - barWidth) / 2;
      const top = plotBottom - barHeight;
      const fill = index === 3 ? C.orange : index === 4 ? C.signal : C.blueDark;
      addBox(slide, `age-bar-${index}`, { left, top, width: barWidth, height: barHeight }, fill);
      addText(slide, {
        name: `age-value-${index}`,
        text: value === 0 ? '0%' : `${value}%`,
        left: left - 8,
        top: Math.max(chartTop - 2, top - 20),
        width: barWidth + 16,
        height: 16,
        fontSize: 10,
        color: C.ink,
        bold: true,
        alignment: 'center',
        lineSpacing: 1,
      });
      addText(slide, {
        name: `age-category-${index}`,
        text: ageLabels[index],
        left: chartLeft + index * barSlot,
        top: plotBottom + 8,
        width: barSlot,
        height: 18,
        fontSize: 10,
        color: C.muted,
        alignment: 'center',
        lineSpacing: 1,
      });
    });
    addText(slide, {
      name: 'demographics-insight',
      text: '64.7% of reported listeners are 28–44. The opportunity is to keep that core while widening who sees themselves in the conversation.',
      left: 64,
      top: 602,
      width: 1110,
      height: 44,
      fontSize: 17,
      color: C.ink,
      bold: true,
      alignment: 'center',
      lineSpacing: 1.2,
    });
    addFooter(slide, 4, false);
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026 (demographic source graphic).',
      'Gender data: male 78.3%, female 18.3%, non-binary 0.7%, not specified 2.7%.',
      'Age data: 0–17 0.1%, 18–22 1.9%, 23–27 11.6%, 28–34 33.9%, 35–44 30.8%, 45–59 15.8%, 60+ 5.8%, unknown 0%.',
    ]);
  }

  // 05 — Hosts
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.deep;
    addEyebrow(slide, 'The people behind the signal', 56, 38, 520, C.iceStrong);
    addTitle(slide, 'A 17-person host team brings field-earned\nperspective.', 56, 66, 1120, 96, C.white, 43);
    addText(slide, {
      name: 'hosts-subtitle',
      text: 'Different regions, disciplines, and lived experience—held together by curiosity and a respect for the work.',
      left: 56,
      top: 164,
      width: 1050,
      height: 44,
      fontSize: 19,
      color: C.iceStrong,
      lineSpacing: 1.2,
    });
    await addImage(slide, A.hosts, 'Nine-person Avalanche Hour remote host collage from Caleb’s partnership email', {
      left: 40,
      top: 216,
      width: 700,
      height: 392,
    });
    addHostNameColumn(slide, [
      'DOM BAKER',
      'DR. BRUCE JAMIESON',
      'KIM VINET',
      'MORGAN DINSDALE',
      'NIKKI CHAMPION',
      'MATTHIAS WALCHER',
      'ANNA HEUBERGER',
      'GABRIELLE ANTONIOLI',
      'SEAN ZIMMERMAN-WALL',
    ], {
      left: 764,
      top: 216,
      width: 240,
      height: 392,
      columnName: 'left',
      fontSize: 18.5,
    });
    addHostNameColumn(slide, [
      'DR. SARA BOILEN',
      'DALLAS GLASS',
      'JAKE HUTCHINSON',
      'SIERRA BISHOP',
      'BRENDAN CRONIN',
      'PASCAL HAEGELI',
      'CALEB MERRILL',
      'BROOKE EDWARDS',
    ], {
      left: 1020,
      top: 216,
      width: 206,
      height: 392,
      columnName: 'right',
      fontSize: 18.5,
    });
    addRule(slide, 'hosts-accent-rule', 40, 622, 1186, C.signal, 4);
    addFooter(slide, 5, true);
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026 (host collage and host list).',
      'Anna Heuberger spelling verified at https://lawine.salzburg.at/en/organisation/staff.',
      'Gabrielle Antonioli spelling verified at https://www.montana.edu/earthsciences/graduate-program/students/antonioli.html.',
      'Pascal Haegeli spelling verified at https://www.sfu.ca/rem/about/people/haegeli.html.',
      'Brendan Cronin follows the current Season 11 planning source, lib/season11MastermindSchedule.mjs.',
    ]);
  }

  // 06 — Listener proof
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.ice;
    addEyebrow(slide, 'Listener proof', 64, 44, 300, C.orange);
    addTitle(slide, 'Listeners carry something useful away.', 64, 76, 930, 62, C.ink, 52);
    addText(slide, {
      name: 'reviews-intro',
      text: 'The feedback is consistent: practical value, different perspectives, and a voice people want in the background when they are not in the mountains.',
      left: 64,
      top: 142,
      width: 1060,
      height: 54,
      fontSize: 19,
      color: C.muted,
      lineSpacing: 1.22,
    });
    addVRule(slide, 'reviews-divider', 640, 230, 310, '#9DB0B8', 1);
    addText(slide, {
      name: 'review-one-stars',
      text: '★★★★★',
      left: 70,
      top: 238,
      width: 220,
      height: 32,
      fontSize: 25,
      color: C.signal,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'review-one-title',
      text: 'Educational & Enjoyable',
      left: 70,
      top: 290,
      width: 500,
      height: 60,
      fontSize: 35,
      color: C.ink,
      typeface: F.serif,
      italic: true,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'review-one-summary',
      text: '“I always walk away from an episode with at least one piece of wisdom.”',
      left: 70,
      top: 374,
      width: 490,
      height: 86,
      fontSize: 23,
      color: C.ink,
      lineSpacing: 1.3,
    });
    addText(slide, {
      name: 'review-one-attribution',
      text: 'PhilSkis23  ·  Mar 30, 2026',
      left: 70,
      top: 502,
      width: 480,
      height: 24,
      fontSize: 15,
      color: C.orange,
      bold: true,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'review-two-stars',
      text: '★★★★★',
      left: 694,
      top: 238,
      width: 220,
      height: 32,
      fontSize: 25,
      color: C.signal,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'review-two-title',
      text: 'Tremendous content and guests',
      left: 694,
      top: 290,
      width: 500,
      height: 78,
      fontSize: 32,
      color: C.ink,
      typeface: F.serif,
      italic: true,
      lineSpacing: 1.05,
    });
    addText(slide, {
      name: 'review-two-summary',
      text: '“It’s highly educational—from emotional well-being and self-care to technical know-how—and, best of all, it’s entertaining.”',
      left: 694,
      top: 388,
      width: 500,
      height: 86,
      fontSize: 23,
      color: C.ink,
      lineSpacing: 1.3,
    });
    addText(slide, {
      name: 'review-two-attribution',
      text: 'WhistleTrout  ·  Dec 5, 2023',
      left: 694,
      top: 502,
      width: 480,
      height: 24,
      fontSize: 15,
      color: C.orange,
      bold: true,
      lineSpacing: 1,
    });
    addFooter(slide, 6, false);
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026, embedded listener-review images (review titles, usernames, dates, and summarized review themes).',
      'The body copy uses direct review excerpts; the WhistleTrout excerpt is lightly copyedited for punctuation and grammar without changing its meaning.',
    ]);
  }

  // 07 — Partner proof
  {
    const slide = presentation.slides.add();
    slide.background.fill = '#D5EEF5';
    addEyebrow(slide, 'Partner proof', 64, 42, 300, C.orange);
    addTitle(slide, 'Because you always need a good partner…', 64, 72, 980, 64, C.ink, 50);
    addText(slide, {
      name: 'partner-proof-intro',
      text: 'The value is not generic reach. It is a credible place inside a community that already cares about the subject.',
      left: 64,
      top: 140,
      width: 980,
      height: 52,
      fontSize: 20,
      color: C.muted,
      lineSpacing: 1.22,
    });
    addVRule(slide, 'partner-proof-divider', 640, 224, 350, '#AFC7CE', 1);
    await addImage(slide, A.austinPowder, 'Austin Powder Avalanche sponsor logo', {
      left: 64,
      top: 224,
      width: 260,
      height: 47.1,
    });
    addText(slide, {
      name: 'austin-quote-mark',
      text: '“',
      left: 64,
      top: 284,
      width: 54,
      height: 54,
      fontSize: 52,
      color: C.signal,
      typeface: F.serif,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'austin-quote',
      text: 'Austin Powder Avalanche is proud to sponsor the Avalanche Hour Podcast, helping bring the past and future of our industry to the forefront.',
      left: 98,
      top: 300,
      width: 470,
      height: 150,
      fontSize: 24,
      color: C.ink,
      typeface: F.serif,
      italic: true,
      lineSpacing: 1.25,
    });
    addRule(slide, 'austin-quote-rule', 98, 470, 84, C.signal, 4);
    addText(slide, {
      name: 'austin-attribution',
      text: 'BRADEN SCHMIDT\nPRESIDENT · AUSTIN POWDER AVALANCHE',
      left: 98,
      top: 490,
      width: 470,
      height: 50,
      fontSize: 15,
      color: C.blueDark,
      bold: true,
      lineSpacing: 1.25,
    });
    await addImage(slide, A.propagationLabs, 'Propagation Labs sponsor logo', {
      left: 700,
      top: 218,
      width: 268,
      height: 65.4,
    });
    addText(slide, {
      name: 'propagation-quote-mark',
      text: '“',
      left: 700,
      top: 284,
      width: 54,
      height: 54,
      fontSize: 52,
      color: C.signal,
      typeface: F.serif,
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'propagation-quote',
      text: 'Advertising on The Avalanche Hour has been an incredible way for us to connect with the core snow and avalanche community.',
      left: 734,
      top: 300,
      width: 450,
      height: 150,
      fontSize: 24,
      color: C.ink,
      typeface: F.serif,
      italic: true,
      lineSpacing: 1.25,
    });
    addRule(slide, 'propagation-quote-rule', 734, 470, 84, C.signal, 4);
    addText(slide, {
      name: 'propagation-attribution',
      text: 'GARRETT HARMSEN\nCO-FOUNDER · PROPAGATION LABS',
      left: 734,
      top: 490,
      width: 450,
      height: 50,
      fontSize: 15,
      color: C.blueDark,
      bold: true,
      lineSpacing: 1.25,
    });
    addFooter(slide, 7, false);
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026 (Austin Powder and Propagation Labs testimonials).',
      'Current project sponsor assets, public/images/sponsors/AustinPowder.png and public/images/sponsors/prop_labs.jpg.',
      'Direct testimonial excerpts reproduced from Caleb’s email asset.',
    ]);
  }

  // 08 — Packages
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.snow;
    addEyebrow(slide, 'Partnership levels', 56, 40, 360, C.orange);
    addTitle(slide, 'Start with one episode—or\nstay present all year.', 56, 68, 1100, 94, C.ink, 43);
    addText(slide, {
      name: 'packages-intro',
      text: 'Each level supports production while giving partners a clear, credible presence with the audience.',
      left: 56,
      top: 164,
      width: 1040,
      height: 40,
      fontSize: 19,
      color: C.muted,
      lineSpacing: 1.2,
    });
    addVRule(slide, 'package-divider-1', 350, 214, 370, '#C4CDCF', 1);
    addVRule(slide, 'package-divider-2', 650, 214, 370, '#C4CDCF', 1);
    addVRule(slide, 'package-divider-3', 950, 214, 370, '#C4CDCF', 1);
    addPackageLane(slide, {
      name: 'Friend',
      price: '$500 / EPISODE',
      left: 56,
      width: 254,
      detail: '1–2 minute mid-episode message\n\nIntro / outro acknowledgment\n\nSocial post + website logo',
    });
    addPackageLane(slide, {
      name: 'Partner',
      price: '$4,000 / SEASON',
      left: 380,
      width: 238,
      detail: '10–15 minutes per season for a representative\n\nAcknowledgment on 25+ episodes\n\nSocial post + website logo',
    });
    addPackageLane(slide, {
      name: 'Legacy',
      price: '$6,000 / SEASON',
      left: 680,
      width: 238,
      detail: 'Season-long support that helps grow the podcast\n\nDesigned for deeper, ongoing alignment',
    });
    addPackageLane(slide, {
      name: 'Slabs ’n Sluffs',
      price: '$5,000+ / SEASON',
      left: 980,
      width: 244,
      detail: 'Extended representative access\n\nGuest or topic proposals, subject to editorial approval\n\nCustom collaboration options',
    });
    addText(slide, {
      name: 'packages-note',
      text: 'Custom packages are available when the standard levels are close—but not quite right.',
      left: 56,
      top: 616,
      width: 1168,
      height: 28,
      fontSize: 17,
      color: C.ink,
      bold: true,
      alignment: 'center',
      lineSpacing: 1,
    });
    addFooter(slide, 8, false);
    addNotes(slide, [
      'Caleb Merrill’s original Season 11 underwriting deck, package slide (package names, prices, and benefits).',
      'User instruction that Caleb’s source deck—not the website—is authoritative for package information.',
      'The newest email’s package screenshot reflects an older website state with the plus signs reversed; the original package slide values are retained here.',
    ]);
  }

  // 09 — Slabs ’n Sluffs
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.paper;
    await addImage(slide, A.slabs, 'Original hand-drawn Slabs ’n Sluffs artwork with two hosts at microphones', {
      left: 48,
      top: 80,
      width: 560,
      height: 560,
    });
    addBox(slide, 'slabs-copy-field', { left: 640, top: 0, width: 640, height: 720 }, C.deep);
    addEyebrow(slide, 'The monthly companion show', 696, 70, 460, C.iceStrong);
    addTitle(slide, 'Monthly, irreverent, and unmistakably Avalanche Hour.', 696, 110, 500, 130, C.white, 52);
    addText(slide, {
      name: 'slabs-body',
      text: 'Hosted by Dom Baker and Sara Boilen, Slabs ’n Sluffs turns listener voicemails, episode recaps, field banter, and partner highlights into a dedicated monthly touchpoint.',
      left: 696,
      top: 274,
      width: 500,
      height: 130,
      fontSize: 22,
      color: C.iceStrong,
      lineSpacing: 1.32,
    });
    addText(slide, {
      name: 'slabs-price',
      text: '$5,000+ / SEASON',
      left: 696,
      top: 448,
      width: 470,
      height: 60,
      fontSize: 46,
      color: C.signal,
      typeface: F.display,
      lineSpacing: 1,
    });
    addRule(slide, 'slabs-rule', 696, 524, 108, C.signal, 4);
    addText(slide, {
      name: 'slabs-benefits',
      text: 'Extended representative access\nGuest or topic proposals\nCustom collaboration options',
      left: 696,
      top: 548,
      width: 480,
      height: 88,
      fontSize: 19,
      color: C.white,
      bold: true,
      lineSpacing: 1.42,
    });
    addText(slide, {
      name: 'slabs-page-number',
      text: '09',
      left: 1180,
      top: 684,
      width: 44,
      height: 16,
      fontSize: 12,
      color: C.iceStrong,
      bold: true,
      alignment: 'right',
      lineSpacing: 1,
    });
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026 (Slabs ’n Sluffs artwork and monthly show format).',
      'Caleb Merrill’s original Season 11 underwriting deck, package slide (Slabs ’n Sluffs price and benefits).',
    ]);
  }

  // 10 — Contact
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.deep;
    await addImage(slide, A.close, 'Avalanche Hour field observation and snow-profile image from Caleb’s partnership email', {
      left: 40,
      top: 24,
      width: 1200,
      height: 360,
    });
    addEyebrow(slide, 'Start a conversation', 64, 422, 380, C.iceStrong);
    addTitle(slide, 'Build the partnership that fits.', 64, 456, 690, 60, C.white, 44);
    addText(slide, {
      name: 'close-body',
      text: 'Choose a standard level—or collaborate on a custom underwriting and advertising package around your goals.',
      left: 64,
      top: 522,
      width: 650,
      height: 66,
      fontSize: 21,
      color: C.iceStrong,
      lineSpacing: 1.28,
    });
    addText(slide, {
      name: 'close-action',
      text: 'EXPLORE SEASON 11 ADVERTISING + UNDERWRITING',
      left: 774,
      top: 438,
      width: 430,
      height: 42,
      fontSize: 20,
      color: C.signal,
      typeface: F.display,
      alignment: 'right',
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'close-contact',
      text: 'theavalanchehour.com/support\ntheavalanchehourpodcast@gmail.com',
      left: 738,
      top: 504,
      width: 466,
      height: 76,
      fontSize: 20,
      color: C.white,
      bold: true,
      alignment: 'right',
      lineSpacing: 1.4,
    });
    addInstagramMark(slide, 1134, 606, 38, C.iceStrong);
    addText(slide, {
      name: 'close-instagram',
      text: '@THEAVALANCHEHOURPODCAST',
      left: 824,
      top: 616,
      width: 298,
      height: 20,
      fontSize: 14,
      color: C.iceStrong,
      bold: true,
      alignment: 'right',
      lineSpacing: 1,
    });
    addText(slide, {
      name: 'close-page-number',
      text: '10',
      left: 1180,
      top: 684,
      width: 44,
      height: 16,
      fontSize: 12,
      color: C.iceStrong,
      bold: true,
      alignment: 'right',
      lineSpacing: 1,
    });
    addNotes(slide, [
      'Caleb Merrill, “Season 11 Partnership Pitch” email, August 20, 2026 (fieldwork closing banner and Instagram icon).',
      'Current project support-page path and contact details, pages/support.js.',
    ]);
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, '0')}`;
    await writeBlob(path.join(RENDER_DIR, `${stem}.png`), await presentation.export({ slide, format: 'png', scale: 1.4 }));
    const layout = await slide.export({ format: 'layout' });
    await fs.writeFile(path.join(LAYOUT_DIR, `${stem}.layout.json`), await layout.text());
  }

  await writeBlob(path.join(TMP, 'final-montage.webp'), await presentation.export({ format: 'webp', montage: true, scale: 1 }));
  const inspection = await presentation.inspect({
    kind: 'slide,textbox,shape,image,chart,notes',
    include: 'id,slide,name,title,textPreview,bbox,bboxUnit,alt',
    maxChars: 120000,
  });
  await fs.writeFile(path.join(TMP, 'final-inspect.ndjson'), inspection.ndjson);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT);
  console.log(OUT);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
