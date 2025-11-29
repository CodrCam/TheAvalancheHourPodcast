// src/data/products.js

export const products = [
  //
  // ReCaps – Corduroy & Foam Trucker (brimmed caps)
  //
  {
    id: 'recaps-caps',
    slug: 'recaps-caps',
    name: 'ReCaps Corduroy & Trucker Hats',
    price: 3800, // $38.00
    active: true,
    description:
      "We've partnered with ReCaps to bring some unique and fun styles of hats. Inspired by the outdoors, motivated by uniqueness, and focused on sustainability, ReCaps designs hats with a distinctive style that will take you from work to play and everywhere in between. Each hat features a slightly shorter brim and hand-printed block prints on reclaimed materials, so print fabric color and shade may vary but that's the beauty of one-of-a-kind.",

    // Styles on this product: brimmed caps only
    styles: ['Corduroy', 'Foam Trucker'],
    colors: [],

    variants: {
      Corduroy: {
        colors: ['Blue/Grey', 'Sage/Purple', 'Yellow', 'Teal'],
        skuByColor: {
          'Blue/Grey': 'recap-cord-blue-grey',
          'Sage/Purple': 'recap-cord-sage-purp',
          Yellow: 'recap-cord-yellow',
          Teal: 'recap-cord-teal',
        },
        imageByColor: {
          'Blue/Grey': '/images/store/recaps/cord-blue-grey.jpg',
          'Sage/Purple': '/images/store/recaps/cord-sage-purp.jpg',
          Yellow: '/images/store/recaps/cord-yellow.jpg',
          Teal: '/images/store/recaps/cord-teal.jpg',
        },
      },

      'Foam Trucker': {
        colors: ['Gold/Dirt'],
        skuByColor: {
          'Gold/Dirt': 'recap-trucker-gold-dirt',
        },
        imageByColor: {
          'Gold/Dirt': '/images/store/recaps/trucker-gold-dirt.jpg',
        },
      },
    },

    // Gallery for caps
    image: '/images/store/recaps/cord-blue-grey.jpg',
    images: [
      '/images/store/recaps/cord-blue-grey.jpg',
      '/images/store/recaps/cord-sage-purp.jpg',
      '/images/store/recaps/cord-yellow.jpg',
      '/images/store/recaps/cord-teal.jpg',
      '/images/store/recaps/trucker-gold-dirt.jpg',
    ],

    imageMap: {
      'Blue/Grey': '/images/store/recaps/cord-blue-grey.jpg',
      'Sage/Purple': '/images/store/recaps/cord-sage-purp.jpg',
      Yellow: '/images/store/recaps/cord-yellow.jpg',
      Teal: '/images/store/recaps/cord-teal.jpg',
      'Gold/Dirt': '/images/store/recaps/trucker-gold-dirt.jpg',
    },
  },

  //
  // ReCaps – Beanies (cuff) & Poms
  //
  {
    id: 'recaps-beanies',
    slug: 'recaps-beanies',
    name: 'ReCaps Beanies & Poms',
    price: 3800, // $38.00
    active: true,
    description:
      "Support The Avalanche Hour Podcast while staying cozy on the skin track and around town. We've partnered with ReCaps to bring you Pom and cuff beanies with a distinctive look and sustainable story. Each block print is hand printed on reclaimed materials, so print fabric color and shade will vary from hat to hat. Enjoy the surprise of a one-of-a-kind beanie.",

    // Styles on this product: beanies only
    styles: ['Beanie', 'Pom'],
    colors: [],

    variants: {
      Pom: {
        colors: ['Blue', 'Green', 'Brown'],
        skuByColor: {
          Blue: 'recap-pom-blue',
          Green: 'recap-pom-green',
          Brown: 'recap-pom-brown',
        },
        imageByColor: {
          Blue: '/images/store/recaps/pom-blue.jpg',
          Green: '/images/store/recaps/pom-green.jpg',
          Brown: '/images/store/recaps/pom-brown.jpg',
        },
      },

      Beanie: {
        colors: ['Black', 'Blue', 'Purple'],
        skuByColor: {
          Black: 'recap-cuff-black',
          Blue: 'recap-cuff-blue',
          Purple: 'recap-cuff-purp',
        },
        imageByColor: {
          Black: '/images/store/recaps/cuff-black.jpg',
          Blue: '/images/store/recaps/cuff-blue.jpg',
          Purple: '/images/store/recaps/cuff-purp.jpg',
        },
      },
    },

    // Gallery for beanies & poms
    image: '/images/store/recaps/cuff-blue.jpg',
    images: [
      '/images/store/recaps/cuff-black.jpg',
      '/images/store/recaps/cuff-blue.jpg',
      '/images/store/recaps/cuff-purp.jpg',
      '/images/store/recaps/pom-blue.jpg',
      '/images/store/recaps/pom-green.jpg',
      '/images/store/recaps/pom-brown.jpg',
    ],

    imageMap: {
      Black: '/images/store/recaps/cuff-black.jpg',
      Blue: '/images/store/recaps/cuff-blue.jpg',
      Purple: '/images/store/recaps/cuff-purp.jpg',
      Green: '/images/store/recaps/pom-green.jpg',
      Brown: '/images/store/recaps/pom-brown.jpg',
    },
  },

  //
  // Voile Straps – 20" Black & 25" Blue (one product, two variants)
  //
  {
    id: 'voile-straps',
    slug: 'voile-straps',
    name: 'Voile Straps',
    // Base price is only a fallback; real price comes from variant-level pricing below
    price: 800, // fallback $8.00
    active: true,
    description:
      '“Sometimes I forget what holds my life together... and then I see another Voile strap.” – CM. Show your support of our community and The Avalanche Hour Podcast by grabbing a handful of ski straps so you never wonder where your last strap went. Perfect for first aid, gear repair, storage, and more.',

    // Customer-facing style options
    styles: ['20"', '25"'],
    colors: [],

    variants: {
      '20"': {
        price: 800, // $8.00
        colors: ['Black'],
        skuByColor: {
          Black: 'strap-20-black',
        },
        imageByColor: {
          Black: '/images/store/straps/strap-20-black.jpg',
        },
      },

      '25"': {
        price: 850, // $8.50
        colors: ['Blue'],
        skuByColor: {
          Blue: 'strap-25-blue',
        },
        imageByColor: {
          Blue: '/images/store/straps/strap-25-blue.jpg',
        },
      },
    },

    // Gallery used on the product page + store card
    image: '/images/store/straps/strap-20-black.jpg',
    images: [
      '/images/store/straps/strap-20-black.jpg',
      '/images/store/straps/strap-25-blue.jpg',
    ],

    imageMap: {
      Black: '/images/store/straps/strap-20-black.jpg',
      Blue: '/images/store/straps/strap-25-blue.jpg',
    },
  },

  //
  // Zip-up Hoodies
  //
  {
    id: 'hoodies',
    slug: 'hoodies',
    name: 'Season 10 Zip-Up Hoodie',
    price: 5000, // $50.00
    active: true,
    description:
      "For a limited time, we've printed Brooke Maushund’s Season 10 artwork on one of our favorite zip-up hooded sweatshirts: the Bella + Canvas Unisex Sponge Fleece Full Zip Hoodie. Choose from Dark Grey Heather or Blue Storm and bring The Avalanche Hour artwork from the skin track to the coffee shop.",

    styles: ['Blue Storm', 'Dark Grey Heather'],
    sizes: ['S', 'M', 'L', 'XL'],

    variants: {
      'Blue Storm': {
        colors: ['Blue Storm'],
        sizes: ['S', 'M', 'L', 'XL'],
        skuBySize: {
          S: 'hoodie-blue-storm-s',
          M: 'hoodie-blue-storm-m',
          L: 'hoodie-blue-storm-l',
          XL: 'hoodie-blue-storm-xl',
        },
        imageByColor: {
          'Blue Storm': '/images/store/hoodies/blue-storm.jpg',
        },
      },
      'Dark Grey Heather': {
        colors: ['Dark Grey Heather'],
        sizes: ['S', 'M', 'L', 'XL'],
        skuBySize: {
          S: 'hoodie-dark-grey-heather-s',
          M: 'hoodie-dark-grey-heather-m',
          L: 'hoodie-dark-grey-heather-l',
          XL: 'hoodie-dark-grey-heather-xl',
        },
        imageByColor: {
          'Dark Grey Heather':
            '/images/store/hoodies/dark-grey-heather.jpg',
        },
      },
    },

    image: '/images/store/hoodies/blue-storm.jpg',
    images: [
      '/images/store/hoodies/blue-storm.jpg',
      '/images/store/hoodies/dark-grey-heather.jpg',
      '/images/store/hoodies/blue-storm-2.jpg',
    ],
    imageMap: {
      'Blue Storm': '/images/store/hoodies/blue-storm.jpg',
      'Blue Storm Front': '/images/store/hoodies/blue-storm-2.jpg',
      'Dark Grey Heather': '/images/store/hoodies/dark-grey-heather.jpg',
    },
  },

  //
  // Free Range Tote
  //
  {
    id: 'free-range-tote',
    slug: 'free-range-tote',
    name: 'Free Range Canvas Tote',
    price: 5500, // $55.00
    active: true,
    description:
      'Ahh yes — you remember these Free Range tote bags from the Bend ISSW. You see them everywhere now. We partnered with our friends at Free Range Equipment to bring you a limited edition tote featuring our Season 10 artwork by Brooke Maushund. Carry ski gear, haul a pot of soup to the potluck, or use the zippered pocket for your valuables, all while showing your support for The Avalanche Hour Podcast.\n\nNote: This tote is a preorder item and will ship on or after January 20th, 2026.',

    image: '/images/store/tote/free-range-canvas.jpg',
    images: ['/images/store/tote/free-range-canvas.jpg'],
  },
];