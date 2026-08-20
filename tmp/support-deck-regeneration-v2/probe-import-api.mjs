import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const file = '/Users/camerongriffin/projects/TheAvalancheHour/tmp/support-deck-regeneration-v2/template-starter.pptx';
const presentation = await PresentationFile.importPptx(await FileBlob.load(file));
const slide = presentation.slides.items[0];

function describe(label, value) {
  console.log(label, {
    ownKeys: Object.keys(value ?? {}),
    protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(value ?? {})),
    length: value?.items?.length,
  });
}

describe('slide', slide);
console.log('showMasterShapesDescriptor', Object.getOwnPropertyDescriptor(Object.getPrototypeOf(slide), 'showMasterShapes'));
describe('shapes', slide.shapes);
describe('images', slide.images);
if (slide.shapes.items.length) describe('shape', slide.shapes.items[0]);
if (slide.images.items.length) describe('image', slide.images.items[0]);
