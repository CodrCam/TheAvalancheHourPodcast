// /src/data/people.js
// Central data source for Hosts & Producers used by /about and /hosts/[slug].
// Conventions:
// - slug: lower-kebab-case for URLs
// - role: 'host' | 'producer'
// - images: paths under /public/images/hosts
// - bioShort: 1–2 lines
// - bioFull: full HTML/text (safe to include <a>, <br/>, etc.)
// - needsBio / needsImages: flags for incomplete entries

export const people = [
  // =========================
  // HOSTS (full bios ingested)
  // =========================

  {
    slug: 'caleb-merrill',
    role: 'host',
    name: 'Caleb Merrill',
    images: [
      '/images/hosts/caleb1.jpg',
      '/images/hosts/caleb2.jpg',
      '/images/hosts/caleb3.jpg',
    ],
    bioShort:
      'Founder/host of The Avalanche Hour; AMGA-certified ski guide and avalanche forecaster/educator.',
    bioFull:
      'Caleb got his start in the snow and avalanche world in 2006 while working as a ski patroller and avalanche mitigation tech at Solitude Mountain Resort in Utah.  He spent 10 winters working as a heli-ski guide in Nevada and Alaska.  Caleb works as an avalanche forecaster and teaches AIARE courses for the Wallowa Avalanche Center- as well as ski guides for Eagle Cap Mountain Guides.   He is a certified ski guide through the AMGA, is a professional member of the American Avalanche Association, and is a level 3 guide-member with Heliski US. While there is no snow on the ground, Caleb enjoys long trail runs with his dog Arlo and riding his dirt bike with his wife Stephani.  Caleb started The Avalanche Hour in 2016 to share stories and moments of learning within our unique community.  He is thrilled to have seen it grow since then to include many diverse voices and perspectives from around the globe.  In 2023, Caleb and the team at The Avalanche Hour Podcast received the Sue Fergeson Award from the American Avalanche Association in recognition of their efforts to promote avalanche awareness to the public through various media endeavors.',
  },

  {
    slug: 'dom-baker',
    role: 'host',
    name: 'Dom Baker',
    images: [
      '/images/hosts/dom1.jpg',
      '/images/hosts/dom2.jpg',
      '/images/hosts/dom3.jpg',
    ],
    bioShort:
      'Whitewater Resort forecaster; BC Ministry of Transportation Kootenay Pass Program; CAA instructor.',
    bioFull:
      "Dom Baker was born in Kenya and grew up in Victoria, BC, spending most of his time there staring at the snowy peaks of the Olympic Mountains of Washington state.  After ski bumming in BC and NZ and working at a cat skiing lodge for a while he became a ski patroller and then avalanche forecaster at Whitewater Resort near Nelson, BC.  Since 2014 he has been working with the Kootenay Pass Avalanche Program for the BC Ministry of Transportation, a job that keeps him learning and engaged to this day.  Instructional work with the Canadian Avalanche Association and hosting with the Avalanche Hour Podcast have been amazing opportunities to share the stoke and explore the various facets of a diverse industry. In his spare time, you'll probably find him skiing or biking with his wife and kids, woodworking or exploring the backcountry somewhere.",
  },

  {
    slug: 'sean-zimmerman-wall',
    role: 'host',
    name: 'Sean Zimmerman-Wall',
    images: [
      '/images/hosts/sean1.jpg',
      '/images/hosts/sean2.jpg',
      '/images/hosts/sean3.jpg',
    ],
    bioShort:
      'Utah-based avalanche pro and educator; founding member of Snowbird Patrol’s Peer Support Team.',
    bioFull:
      'Sean is a father and lifelong learner. Living in Utah for almost two decades, he has worked extensively in ski area and mechanized guiding operations. Sean’s values include helping others and creating things that endure. He is a founding member of Snowbird Ski Patrol’s Peer Support Team and is grateful to have the opportunity to help his fellow patrollers stay in the Green. Additional roles Sean fulfills include the management of AIARE’s professional avalanche education program and operational oversight for the delivery of courses. He served three consecutive terms on the American Avalanche Association Board of Trustees and is now moving to volunteerism in his children’s school system.',
  },

  {
    slug: 'brooke-edwards',
    role: 'host',
    name: 'Brooke Edwards',
    images: [
      '/images/hosts/brookeE1.jpg',
      '/images/hosts/brookeE2.jpg',
      '/images/hosts/brookeE3.jpg',
    ],
    bioShort:
      'Career guide/educator (30 yrs) in AK & WA; PSIA III; shifting into resiliency coaching.',
    bioFull:
      'Brooke hails from the Great Pacific Northwest where her passion for all things outdoors was born. Calling Girdwood, Alaska her home for the last 28 years, she could always be found year-round exploring and guiding the mountains and rivers of that vast wilderness. Recently Brooke chose to return to her home state of Washington to be close to family. Brooke loves sharing her passion for skiing by being an avalanche educator, a ski guide, and a PSIA Level III ski instructor. Brooke has been a career guide and educator for 30 years. She brings an enthusiasm for the conservation of wild spaces and a joy of being humbled by what wild places have to offer to her guiding craft. Brooke is currently shifting her guiding career to one of resiliency coaching via her own LLC, Wild World Wanderings: <a href="http://www.wildworldwanderings.com" target="_blank" rel="noopener noreferrer">Wild World Wanderings</a>.',
  },

  // Use the NEW bio you provided (replacing older summary)
  {
    slug: 'matthias-walcher',
    role: 'host',
    name: 'Matthias Walcher',
    images: [
      '/images/hosts/matthias1.jpg',
      '/images/hosts/matthias2.jpg',
      '/images/hosts/matthias3.jpg',
    ],
    bioShort:
      'Avalanche forecaster (Tyrol) and President of ÖGSL; background across Europe and the Americas.',
    bioFull:
      'Matthias grew up in the Italian Dolomites, where his love for mountains and nature first took root. He went on to study Mountain Risk Engineering at the University of Natural Resources and Life Sciences in Vienna, with time spent abroad at SFU in Canada. Since 2015, he has been part of the professional snow and avalanche community, working across the Americas and with various European avalanche warning services. These days, he is an avalanche forecaster for the Tyrolean Avalanche Warning Service and serves as President of the Austrian Association for Snow and Avalanches (ÖGSL).',
  },

  {
    slug: 'sara-boilen',
    role: 'host',
    name: 'Sara Boilen',
    images: [
      '/images/hosts/sara1.jpeg',
      '/images/hosts/sara2.jpg',
      '/images/hosts/sara3.jpeg',
    ],
    bioShort:
      'Clinical psychologist focusing on human factors in avalanche terrain; prolific workshop presenter.',
    bioFull:
      'Sara Boilen holds a doctorate in clinical psychology from the University of Denver (2011). Professionally, she works with individuals who have had interactions with the justice system often in the spirit of helping to make sense of behavior and context. She has taken her professional interests and merged it with her recreational interests to contribute to the field of avalanche sciences in her free time. She is specifically interested in human-related problems and solutions. Dr. Boilen has presented at seven Snow and Avalanche Workshops and at ISSW in Norway. She has written articles for The Avalanche Review and was a co-author on the recently proposed conceptual framework for human factors in avalanche terrain. She lives in Northwest Montana and will carry dessert for you to the top of any mountain her skills will take her to.',
  },

  {
    slug: 'brooke-maushund',
    role: 'host',
    name: 'Brooke Maushund',
    images: [
      '/images/hosts/brookeM1.jpg',
      '/images/hosts/brookeM2.jpg',
      '/images/hosts/brookeM3.jpg',
    ],
    bioShort:
      'ESAC forecaster; prior roles with NWAC, Sawtooths, SAR, NPS; risk management across seasons.',
    bioFull:
      "Brooke has always been drawn to 'type two fun' and problem-solving in breathtaking settings. After earning her B.S. in Resource Science from UC Berkeley, she initially applied her skills to off grid renewable energy projects in Nicaragua and East Africa. However, a summer climbing trip to Yosemite in her early twenties intended as a brief hiatus before graduate school turned into a lifelong pursuit of adventure and balance.Seeking a better integration of work with her passions for climbing and skiing, Brooke found her niche as a weather station technician for the National Park Service, spending winters chasing snow. It wasn’t long before she set her sights on a career in avalanche forecasting. Her path included roles in snow surveying, ski patrolling, avalanche instruction, observing, and guiding, culminating in her current position as a forecaster at the Eastern Sierra Avalanche Center.Brooke began her forecasting journey as an intern at the Northwest Avalanche Center and later launched her public forecasting career in Idaho's Sawtooth Mountains. Summers have taken her to diverse environments managing risk as a climbing ranger, search and rescue technician, and visiting avalanche forecaster in Yosemite, Patagonia, Washington, and Alaska. Her ideal day starts with the glow of sunrise and the headlamps switched off, miles already behind and still ahead. It ends back home with the company of a dog to pet and memories made in the mountains.",
  },

  {
    slug: 'jason-antin',
    role: 'host',
    name: 'Jason Antin',
    images: [
      '/images/hosts/jason1.jpg',
      '/images/hosts/jason2.jpg',
      '/images/hosts/jason3.jpg',
    ],
    bioShort:
      'IFMGA guide, AAI/AIARE educator; endurance athlete; “Beat Monday” co-creator.',
    bioFull:
      'Originally from Massachusetts and now based in Colorado, Jason Antin is a highly accomplished IFMGA internationally licensed mountain guide, avalanche educator, and endurance athlete. As a host of The Avalanche Hour Podcast, Jason shares his expertise and passion for snow science, mountain safety, and the human stories behind avalanche education and backcountry exploration.Jason began his professional career on snow as a snowboard instructor at Nashoba Valley Ski Area in Massachusetts. Today, he is a Recreational and Professional Avalanche Instructor with the American Avalanche Institute (AAI) and a Course Leader for the American Institute for Avalanche Research and Education (AIARE). With over 20 years of professional backcountry experience, Jason specializes in risk management and wilderness medicine, helping others navigate the challenges of mountain environments. His adventurous spirit has taken him on remarkable feats, such as summiting Denali twice in a single week (including via the Cassin Ridge), climbing The Nose of El Capitan in under 24 hours, and completing endurance challenges like the Rainier Infinity Loop, the Orizaba Rodeo, and the Cascades Trifecta—skiing Mount Rainier, Mount Adams, and Mount Hood in a single day. In addition to guiding, Jason coaches athletes at The Alpine Training Center in Boulder, CO, and through the Uphill Athlete team, preparing individuals from around the globe physically and mentally for their mountain pursuits. He is also known for his Beat Monday project, which showcases creative weekend adventures and has been featured on Outside TV. At home in Golden, CO, Jason balances his adventurous career with family life. He enjoys sharing his love of the outdoors with his wife, Jenny, and their two daughters, Avery and Andora. Whether on trails, rock, ice, or snow, Jason’s mission is clear: to inspire and equip others to explore the mountains safely and confidently.',
  },

  {
    slug: 'jake-hutchinson',
    role: 'host',
    name: 'Jake Hutchinson',
    images: [
      '/images/hosts/jake1.jpg',
      '/images/hosts/jake2.jpg',
      '/images/hosts/jake3.jpg',
    ],
    bioShort:
      'Snow Safety Manager (Irwin Cats); Technical Director (AAI); 30+ years as an avalanche pro.',
    bioFull:
      'Jake Hutchinson has been working as an avalanche professional for over 30 years.  He is currently the Snow Safety Manager for Irwin Cat skiing in Crested Butte, CO and the Technical Director for the American Avalanche Institute.  He worked as a professional Ski Patroller at The Canyons (now Park City) for 21 years and held both Snow Safety Director and Patrol Director positions in his tenure there. He spent 3 amazing seasons forecasting for the going to the Sun road and has held various roles including Vice-President of Wasatch Backcountry Rescue, Membership Trustee of the American Avalanche Association and advisor/instructor for Colorado Rapid Avalanche Deployment. He is a founding member of Warriors Healing Network where he currently serves on the board as Secretary, working with vets, law enforcement and first responders to treat PTSD. In the summer you will find him chasing a reborn passion of desert rivers and whitewater and wandering the desert southwest with his two Malinois pups.',
  },

  // Update images for the following
  {
    slug: 'kim-vinet',
    role: 'host',
    name: 'Kim Vinet',
    images: [
      '/images/hosts/kim1.jpg',
      '/images/hosts/kim2.jpg',
      '/images/hosts/kim3.jpg',
    ],
    bioShort:
      'Former freeride skier and heli-ski guide; vice chair at Mountain Muskox Mentorship.',
    bioFull:
      'Kim has been living and playing in the mountains around Revelstoke, BC since 2009. She started out as a freeride skier, competing in North & South America on the FWT qualifier series. She started ski guiding back in 2011 and was fortunate to participate in the CAA’s avalanche risk programs as well as both the CSGA and ACMG’s guide training programs. Kim guided ski touring, cat skiing and heliskiing (her favourite) until 2023. She is now proudly retired from ski guiding and gives back to the outdoors community through her role as Vice Chair of Mountain Muskox Mentorship – a non-profit creating a community of supportive care for those impacted by trauma or loss in the mountains. Kim is extremely passionate about empowering others to connect with nature and with each other through safe, trauma-informed decision making.',
  },

  {
    slug: 'lynne-wolfe',
    role: 'host',
    name: 'Lynne Wolfe',
    images: [
      '/images/hosts/lynne1.jpg',
      '/images/hosts/lynne2.jpg',
      '/images/hosts/lynne3.jpg',
    ],
    bioShort:
      'Retired Teton guide; longtime editor of The Avalanche Review; AAI Pro Program instructor.',
    bioFull:
      'Lynne Wolfe is a retired Teton guide, editor of The Avalanche Review, and she teaches a few courses a season for AAI in the Pro program. She lives in Driggs, Idaho, with husband Dan Powers and the Lucky Dog. She can be influenced by offering dark chocolate, thick coffee, or hazy IPA.',
  },

  // Placeholders you requested
  {
    slug: 'sierra-bishop',
    role: 'host',
    name: 'Sierra Bishop',
    images: [
      '/images/hosts/sierra1.png',
      '/images/hosts/sierra2.jpg',
      '/images/hosts/sierra3.jpg',
    ],
    needsBio: true,
    needsImages: false,
    bioShort: 'Bio coming soon.',
    bioFull: 'Bio coming soon.',
  },
  {
    slug: 'bruce-jamieson',
    role: 'host',
    name: 'Bruce Jamieson',
    images: [
      '/images/hosts/bruce1.jpg',
      '/images/hosts/bruce2.jpg',
      '/images/hosts/bruce3.jpg',
    ],
    needsBio: true,
    needsImages: true,
    bioShort: 'Bio coming soon.',
    bioFull: 'Bio coming soon.',
  },
  {
    slug: 'joe-stock',
    role: 'host',
    name: 'Joe Stock',
    images: [
      '/images/hosts/joe1.jpg',
      '/images/hosts/joe2.jpg',
      '/images/hosts/joe3.jpg',
    ],
    bioShort:
      'Anchorage-based IFMGA Mountain Guide with a lifelong passion for avalanches, teaching, and exploration.',
    bioFull:
      'Joe is an Anchorage, Alaska-based IFMGA Mountain Guide. His avalanche passion began as a kid learning to backcountry ski in the Wallowa Mountains in Oregon. Since then his avalanche obsession has become chronic: avoiding avalanches in remote Alaska with friends and clients, teaching avalanche classes, and learning about avalanche topics that have never been written about. When not in Alaska, Joe is guiding in Chamonix, or rock climbing with his dream wife Cathy.',
  },

  // =========================
  // PRODUCERS
  // =========================

  {
    slug: 'cam-griffin',
    role: 'producer',
    name: 'Cam Griffin',
    images: [
      '/images/hosts/cam1.jpg',
      '/images/hosts/cam2.jpeg',
      '/images/hosts/cam3.jpeg',
    ],
    bioShort:
      'Season 7+ producer handling audio, social, and web; lifelong outdoorsman.',
    bioFull:
      'Cameron is a former Marine who returned to his home state of Washington after completing active duty in 2009. His love for the outdoors eventually pulled him back into the backcountry, where he realized the importance of formal education in safe mountain travel. Cameron pursued courses through renowned organizations such as The Mountaineers, The American Alpine Institute, North Cascade Mountain Guides, and the Silverton Avalanche School.It was during this period of learning that he discovered The Avalanche Hour Podcast. The insightful discussions and expert advice from the podcast had a profound impact on him, helping him make better informed decisions in avalanche terrain. Grateful for the value it brought to his life, Cameron decided to give back by contributing his skills.With a background in audio engineering, Cameron reached out to Caleb and joined the team in Season 7. Since then, he has been an integral part of the program, contributing to audio editing, social media management, and web design.',
  },

  {
    slug: 'bob-keating',
    role: 'producer',
    name: 'Bob Keating',
    images: [
      '/images/hosts/bob1.jpg',
      '/images/hosts/bob2.jpg',
      '/images/hosts/bob3.jpg',
    ],
    needsBio: true,
    needsImages: true,
    bioShort: 'Producer — bio coming soon.',
    bioFull: 'Bio coming soon.',
  },
];