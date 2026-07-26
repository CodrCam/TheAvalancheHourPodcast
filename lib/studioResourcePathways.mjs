const PATHWAYS = [
  {
    id: 'host',
    audience: 'For hosts',
    title: 'Host an episode, step by step',
    summary:
      'A first-time-friendly refresher from assignment and guest prep through Riverside recording, upload checks, and the producer handoff.',
    access_permissions: ['episodes:update'],
    accent: 'host',
    suggested_searches: [
      'set up Riverside',
      'audio check before recording',
      'Riverside upload not finished',
      'prepare a guest',
      'deliver episode files',
      'request a mic kit',
    ],
    steps: [
      {
        id: 'host-start-here',
        title: 'Start here: understand the assignment',
        label: 'Before contacting the guest',
        href: '/studio/episodes',
        action: 'Open My Episodes',
        permission: 'episodes:read',
        description:
          'Begin in My Episodes so you know the story assignment, release date, host-package deadline, sponsor requirements, and what the production team expects before you schedule anything.',
        use_for:
          'Turning a broad episode idea into a visible plan that the host, coordinator, and producer can all follow.',
        handoff:
          'The Episode Studio becomes the shared source of truth. Save decisions there instead of leaving the plan scattered across email and text messages.',
        instructions: [
          'Open My Episodes and select the episode assigned to you.',
          'Confirm the release date and the earlier host-package due date.',
          'Read every visible requirement, especially sponsor or advertisement instructions.',
          'Review the existing guest, story, and production notes before adding new information.',
          'Write down the one thing the audience should understand or feel by the end of the episode.',
          'Use the Episode Studio discussion to flag a missing date, unclear assignment, or production question.',
          'Do not record until the topic, guest, and expected deliverables are clear.',
        ],
        keywords: [
          'assignment',
          'new episode',
          'start',
          'deadline',
          'release date',
          'pitch',
          'timeline',
        ],
      },
      {
        id: 'host-guest-prep',
        title: 'Prepare the guest and interview',
        label: 'Several days before recording',
        href: '/studio/episodes',
        action: 'Open Guest and Story Planning',
        permission: 'episodes:update',
        description:
          'A short pre-interview conversation prevents avoidable technical surprises and reveals the part of the story the guest is most excited to tell.',
        use_for:
          'Confirming the story, the guest’s details, the recording location, their equipment, and a useful set of fallback questions.',
        handoff:
          'Save the guest details, story angle, questionnaire, and interview plan in the Episode Studio so they remain attached to the episode.',
        instructions: [
          'Schedule a short pre-interview chat a few days before the real recording.',
          'Confirm the guest’s name, title, organization, pronunciation, biography, and public links.',
          'Explain the story angle and ask what feels new, useful, or exciting about the topic.',
          'Ask the guest to record in a quiet, soft-furnished room with no fans, pets, dishes, or nearby conversations.',
          'Confirm that the guest has closed-back headphones or wired earbuds and a usable microphone.',
          'Ask everyone to silence phones, computers, watches, and message notifications before recording.',
          'Prepare 10–12 simple fallback questions that begin with How, Why, or What.',
          'Treat the questions as a safety net: listen closely and follow the guest’s answers instead of forcing the list.',
        ],
        keywords: [
          'guest',
          'pre interview',
          'pre-interview',
          'questions',
          'questionnaire',
          'quiet room',
          'headphones',
          'story',
        ],
      },
      {
        id: 'host-mic-kits',
        title: 'Request and test a microphone kit',
        label: 'Allow time for shipping',
        href: '/studio/mic-kits',
        action: 'Open Mic Kits',
        permission: 'mic_kits:read',
        description:
          'The preferred setup is an Avalanche Hour kit or another dedicated microphone, plus headphones. Equipment should be requested and tested well before the interview.',
        use_for:
          'Checking kit availability, requesting equipment for an episode, and tracking its current holder or shipping state.',
        handoff:
          'The logistics team uses the same request to coordinate delivery and the next movement of the kit.',
        instructions: [
          'Open Mic Kits and check availability as soon as the interview date is taking shape.',
          'Request the kit for the correct episode and provide the private shipping information requested in the form.',
          'Leave enough time for shipping; do not wait until the day before the interview.',
          'When it arrives, connect the microphone and headphones to the same computer you will use for Riverside.',
          'Make a short test recording and listen back through headphones.',
          'Return or transfer the kit using the logistics instructions shown with the request.',
        ],
        keywords: [
          'microphone',
          'mic',
          'kit',
          'equipment',
          'shipping',
          'headphones',
          'test recording',
        ],
      },
      {
        id: 'host-riverside-setup',
        title: 'Choose the Riverside studio and schedule the session',
        label: 'Before recording day',
        href: '/studio/episodes',
        action: 'Open the Episode Studio',
        permission: 'episodes:update',
        description:
          'Riverside records a separate local track for each person. Use the approved Avalanche Hour production and studio, schedule the session in Planner, and invite the interview subject as a Guest.',
        use_for:
          'Avoiding duplicate studios, wrong-role invitations, incorrect times, and a recording saved under an unrecognizable session name.',
        handoff:
          'Record the confirmed date in the Episode Studio. Riverside creates the project after the scheduled recording finishes; credentials remain only in the team password manager.',
        instructions: [
          'Open the approved Avalanche Hour Riverside account using the team password manager; never paste credentials into episode notes.',
          'Select the existing Avalanche Hour production and the studio assigned to the episode; ask before creating a duplicate.',
          'Open Planner, choose the date, select Schedule, and choose Session.',
          'Name the session clearly with the episode or guest name.',
          'Set the start and end time and read the displayed time zone even though Riverside normally begins with the host’s local zone.',
          'Add the interview subject with the Guest role and create the session.',
          'Ask the guest to join from a supported desktop browser with their microphone and headphones already connected.',
          'Plan to enter early enough to complete a real audio check before the interview.',
          'Use the Riverside field-manual sections below if any part of scheduling, invitation, or guest entry is unfamiliar.',
        ],
        keywords: [
          'Riverside',
          'studio',
          'session',
          'invite',
          'invitation',
          'time zone',
          'planner',
          'production',
          'project',
          'credentials',
          'password',
        ],
      },
      {
        id: 'host-recording-check',
        title: 'Run the recording-day audio check',
        label: 'Before pressing Record',
        href: '/studio/episodes',
        action: 'Review Recording Requirements',
        permission: 'episodes:update',
        description:
          'Most unusable audio comes from a preventable setup problem. Check the room, connection, microphone, headphones, and a short sample before beginning the interview.',
        use_for:
          'Making sure Riverside is hearing the intended microphone—not the laptop mic—and that both people can hear without echo.',
        handoff:
          'Once both voices sound clear and the connection is stable, begin the formal recording and capture every required segment.',
        instructions: [
          'Close doors and windows and remove avoidable noise such as fans, dishes, pets, keyboard typing, pen clicking, and desk tapping.',
          'Use Ethernet when possible. If Wi-Fi is the only option, move close to the router and stop other large uploads or streams.',
          'Plug in the microphone and headphones before entering the Riverside studio.',
          'In Riverside, choose the intended external microphone and the correct headphone output for each person.',
          'Have everyone wear closed-back headphones or wired earbuds; never play the guest through laptop speakers.',
          'If someone truly cannot wear headphones, select “I am not wearing headphones” and enable echo cancellation.',
          'Decide on Noise Reduction before recording: Riverside recommends it outside soundproofed rooms, but it permanently filters the recorded tracks.',
          'Open the Record-button menu and run Riverside’s 15-second test recording.',
          'Speak at normal interview volume and listen for room echo, distortion, rubbing, or the hollow sound of a laptop microphone.',
          'Fix the problem and repeat the sample before starting the interview.',
        ],
        keywords: [
          'audio check',
          'sound check',
          'wrong microphone',
          'laptop mic',
          'headphones',
          'echo',
          'background noise',
          'low data',
          'ethernet',
          'wifi',
        ],
      },
      {
        id: 'host-record-and-upload',
        title: 'Record—and do not leave before upload finishes',
        label: 'During and immediately after',
        href: '/studio/episodes',
        action: 'Open the Recording Checklist',
        permission: 'episodes:update',
        description:
          'Pressing Stop does not mean the local tracks are safely delivered. Capture the required soundbites, then keep every Riverside tab open until each person’s track reaches a complete upload.',
        use_for:
          'Running the interview, handling the sponsor break cleanly, and protecting the separate high-quality tracks after recording.',
        handoff:
          'When the uploads are complete, download the separate WAV files, keep a local backup, and attach them to the correct Episode Studio checklist items.',
        instructions: [
          'Press Record and confirm Riverside visibly shows that the session is recording.',
          'Capture the guest identification line: “This is [guest name], and you are listening to The Avalanche Hour Podcast.”',
          'Listen and let the conversation breathe; a short pause is easier to edit than talking over the guest.',
          'At the planned point, leave a natural pause for the mid-roll advertisement.',
          'Follow the current sponsor instructions in the Episode Studio; do not reuse an old script from memory.',
          'During the interview, use the People sidebar to confirm that every participant is recording and uploading.',
          'After the interview, press Stop and check Upload Complete or Successfully uploaded for every participant—not only the top indicator for your own track.',
          'If waiting is awkward, turn off the microphone and camera—but keep the browser and Riverside session open.',
          'Do not let anyone close the tab, quit the browser, clear browser data, or shut down the computer until their upload shows complete.',
          'Download the separate WAV tracks when available and keep a local copy until production is finished.',
        ],
        keywords: [
          'record',
          'Riverside',
          'upload',
          'stuck',
          'incomplete',
          'guest identification',
          'soundbite',
          'mid roll',
          'sponsor',
          'WAV',
        ],
      },
      {
        id: 'host-listen-back',
        title: 'Listen back and prepare edit directions',
        label: 'As soon as practical',
        href: '/studio/episodes',
        action: 'Open Edit Notes',
        permission: 'episodes:update',
        description:
          'You do not need to become the producer, but you do need to listen back and tell the producer where the story is strongest and what needs attention.',
        use_for:
          'Identifying cuts, factual corrections, pronunciation issues, long pauses, and two or three strong opening soundbites.',
        handoff:
          'The producer receives exact filenames, timestamps, requested actions, and the intended result instead of having to guess what “fix this part” means.',
        instructions: [
          'Listen to the recording soon enough that the conversation is still fresh.',
          'Use the exact WAV filename when writing every note.',
          'For each change, provide a start and end timestamp in HH:MM:SS–HH:MM:SS format.',
          'State the action clearly: keep, cut, shorten, move, replace, cover with narration, or review.',
          'Explain the reason or the result the listener should hear after the change.',
          'Identify two or three strong possible opening soundbites with exact timestamps.',
          'Flag factual corrections, name pronunciations, sensitive material, and any section that must remain untouched.',
          'Save the notes in the Episode Studio under the matching checklist item.',
        ],
        keywords: [
          'listen back',
          'rough cut',
          'edit',
          'timestamps',
          'soundbite',
          'producer',
          'notes',
        ],
      },
      {
        id: 'host-delivery',
        title: 'Build and submit the producer package',
        label: 'Official episode handoff',
        href: '/studio/episodes',
        action: 'Open Episode Files and Checklist',
        permission: 'episodes:update',
        description:
          'The Episode Studio package is the producer’s official handoff: recording tracks, ad audio, edit notes, introduction, show notes, links, social copy, photos, captions, credits, and permissions.',
        use_for:
          'Completing the required checklist with clearly labeled files and enough direction for the next person to work without chasing you down.',
        handoff:
          'Submission moves the saved package into producer review. The producer can accept it or request changes in the same Studio.',
        instructions: [
          'Upload each separate Riverside WAV track under the matching recording checklist item.',
          'Add the current sponsor or ad audio exactly where the episode requirements request it.',
          'Upload or enter the edit notes, introduction, show notes, guest biography, useful links, music, and social copy.',
          'For every image, include its order and purpose, preferred crop, caption, creator credit, permission status, and restrictions.',
          'Use clear filenames and mark obsolete versions so the producer cannot choose the wrong asset.',
          'Review every required checklist item and resolve any missing or blocked item honestly.',
          'Use the discussion to explain a known gap or unusual production decision.',
          'Submit only when the visible package reflects everything you intend the producer to use.',
        ],
        keywords: [
          'deliver',
          'submit',
          'upload audio',
          'episode files',
          'producer package',
          'show notes',
          'photos',
          'credits',
          'checklist',
        ],
      },
      {
        id: 'host-profile',
        title: 'Keep your public host profile current',
        label: 'Occasional maintenance',
        href: '/studio/profile',
        action: 'Review My Profile',
        permission: 'profile:self:read',
        description:
          'Your profile controls the biography and approved photography used for your public Avalanche Hour presentation.',
        use_for:
          'Updating your own host biography and photos. Guest information belongs in the Episode Studio instead.',
        handoff:
          'Saved profile changes update the public host presentation without changing episode assignments or guest records.',
        instructions: [
          'Open My Profile and review the public biography for outdated roles, organizations, or links.',
          'Use an approved, high-quality photo and confirm that The Avalanche Hour has permission to publish it.',
          'Save the profile, then keep guest-specific details inside the appropriate Episode Studio.',
        ],
        keywords: ['profile', 'host bio', 'biography', 'headshot', 'photo'],
      },
    ],
    faqs: [
      {
        id: 'host-faq-start',
        question: 'Where do I start when I have a new episode?',
        answer:
          'Open My Episodes, choose the assigned episode, and use its Episode Studio as the shared source for guest details, requirements, files, and discussion.',
        href: '/studio/episodes',
        action: 'Open My Episodes',
        permission: 'episodes:read',
        keywords: ['assignment', 'new episode', 'begin', 'start'],
      },
      {
        id: 'host-faq-riverside',
        question: 'Where are the Riverside setup instructions?',
        answer:
          'Use the Riverside quick walkthroughs above for the immediate sequence. Then open the Host Field Manual below for the full studio structure, Planner and invitation steps, lobby test, upload verification, recovery, and high-quality WAV download instructions.',
        keywords: [
          'Riverside',
          'instructions',
          'tutorial',
          'studio setup',
          'how to record',
        ],
      },
      {
        id: 'host-faq-wrong-mic',
        question: 'How do I know Riverside is using the right microphone?',
        answer:
          'Open Riverside’s input settings, select the intended external microphone by name, make a short sample, and listen back through headphones. A distant or hollow sound often means the laptop microphone is still selected.',
        keywords: [
          'Riverside',
          'microphone',
          'wrong mic',
          'input',
          'sound check',
          'hollow',
        ],
      },
      {
        id: 'host-faq-no-headphones',
        question: 'What if the guest does not have headphones?',
        answer:
          'Headphones are strongly preferred because speakers can feed the conversation back into the microphone. If there is no alternative, select “I am not wearing headphones” in Riverside, enable echo cancellation, keep speaker volume low, and run another audio test before recording.',
        keywords: [
          'guest',
          'headphones',
          'earbuds',
          'echo',
          'speakers',
          'echo cancellation',
        ],
      },
      {
        id: 'host-faq-internet',
        question: 'What should I do if the Riverside connection is struggling?',
        answer:
          'Use Ethernet if available, stop other large uploads or streams, move closer to the Wi-Fi router, enable low-data mode, and turn off video if needed. Protect clean audio first and tell the producer about any interruption in the Episode Studio.',
        keywords: [
          'Riverside',
          'internet',
          'connection',
          'wifi',
          'ethernet',
          'low data',
          'video',
        ],
      },
      {
        id: 'host-faq-upload',
        question: 'What if a Riverside track is still uploading?',
        answer:
          'Keep that person’s Riverside tab and computer open. They may turn off their microphone and camera while waiting, but they should not close the browser, clear browser data, or shut down. If it closed too early, return to riverside.com/upload on the same computer and browser profile. Preserve the session and notify the producer before taking any destructive step.',
        href: '/studio/episodes',
        action: 'Notify the Producer',
        permission: 'episodes:update',
        keywords: [
          'Riverside',
          'upload',
          'stuck',
          'incomplete',
          'processing',
          'track',
          'browser',
        ],
      },
      {
        id: 'host-faq-edit',
        question: 'Do I need to edit the entire episode myself?',
        answer:
          'Not necessarily. At minimum, listen back and provide the exact filename, timestamp range, requested action, and reason for every important edit. Also identify two or three strong opening soundbites. Follow any additional assignment shown in the Episode Studio.',
        keywords: [
          'edit',
          'rough cut',
          'listen back',
          'timestamps',
          'producer',
          'soundbites',
        ],
      },
      {
        id: 'host-faq-submit',
        question: 'What happens when I submit my episode package?',
        answer:
          'Submission moves the current package into producer review. Your saved work and files stay attached, and the producer can accept it or request changes in the same Studio.',
        keywords: ['submit', 'producer review', 'request changes', 'accept'],
      },
      {
        id: 'host-faq-submit-blocked',
        question: 'Why will the Episode Studio not let me submit?',
        answer:
          'A required checklist item is probably incomplete or missing its evidence. Review the visible requirements, attach the requested file or information to the matching item, and use the discussion to explain any legitimate blocker instead of marking unfinished work complete.',
        href: '/studio/episodes',
        action: 'Review My Episode Checklist',
        permission: 'episodes:update',
        keywords: [
          'submit',
          'blocked',
          'required',
          'missing',
          'checklist',
          'cannot submit',
        ],
      },
      {
        id: 'host-faq-package',
        question: 'What belongs in the final producer package?',
        answer:
          'Include the separate Riverside WAV tracks, required ad audio, timestamped edit notes, introduction, show notes, guest biography and links, social copy, music and credits, plus approved photos with order, crop, captions, creator credits, permissions, and restrictions.',
        keywords: [
          'producer package',
          'deliverables',
          'WAV',
          'show notes',
          'photos',
          'social',
          'credits',
        ],
      },
      {
        id: 'host-faq-credentials',
        question: 'Where do I get the Riverside login?',
        answer:
          'Use the approved team password manager or contact the coordinator if your access is missing. Never paste a Riverside password into the Host Guide, Episode Studio, discussion, email, or shared document.',
        keywords: [
          'Riverside',
          'login',
          'password',
          'credentials',
          'access',
          'password manager',
        ],
      },
      {
        id: 'host-faq-files',
        question: 'How long do uploaded episode files stay available?',
        answer:
          'Episode assets are retained for 180 days after upload. The Studio is the official handoff location, but long-term working or archive copies should be stored elsewhere.',
        keywords: ['files', 'uploads', 'expire', 'retention', '180 days'],
      },
    ],
  },
  {
    id: 'operations',
    audience: 'For coordination and logistics',
    title: 'Operations and fulfillment',
    summary:
      'Keep products, stock, customer shipments, equipment visibility, and cross-team follow-through moving from one connected operating system.',
    access_permissions: ['orders:read', 'inventory:read'],
    accent: 'operations',
    suggested_searches: [
      'create a product',
      'assign product images',
      'sold out or standby',
      'update stock',
      'ship an order',
      'legacy stock record',
    ],
    steps: [
      {
        id: 'operations-overview',
        title: 'Admin Overview',
        label: 'Daily triage',
        href: '/admin',
        action: 'Open Admin Overview',
        permission: 'orders:read',
        description:
          'A quick read on new orders, low inventory, and any episode work available to your account.',
        use_for:
          'Start here when you need to know what deserves attention before opening a detailed workspace.',
        handoff:
          'Move into Orders, Products & stock, or the Episode Calendar to make the actual update.',
        instructions: [
          'Review the attention cards for new orders and low or sold-out stock.',
          'Open the detailed workspace named by the card; the Overview is a starting point, not an editing screen.',
          'Return after the update to confirm the attention count has cleared or changed.',
        ],
        keywords: ['dashboard', 'attention', 'daily', 'low stock', 'triage'],
      },
      {
        id: 'operations-products',
        title: 'Product catalog',
        label: 'Storefront structure',
        href: '/admin/products',
        action: 'Open Product Catalog',
        permission: 'products:read',
        description:
          'The Catalog view controls the product customers recognize: name, description, URL, category, collection, storefront position, visibility, variants, prices, and images.',
        use_for:
          'Create a complete product line or revise how an existing product is organized and presented in the storefront.',
        handoff:
          'Saving writes the catalog and synchronizes each variant with stock. Draft and standby products stay available to the backend without appearing for customers.',
        instructions: [
          'Choose an existing product or select New product.',
          'Complete Storefront details and choose a shared product category.',
          'Set Draft, Live, Standby, or Archived based on whether customers should see it.',
          'Add each sellable SKU as a product variant with its own price and options.',
          'Assign images to the matching variant, confirm the shopper preview, and save.',
        ],
        keywords: [
          'new product',
          'create',
          'category',
          'collection',
          'description',
          'slug',
          'price',
          'publish',
        ],
      },
      {
        id: 'operations-product-media',
        title: 'Product images and variants',
        label: 'Shopper presentation',
        href: '/admin/products',
        action: 'Manage Product Images',
        permission: 'product_media:update',
        description:
          'Images live with the product variant they represent, so selecting a color or style in the storefront shows the correct item instead of an unrelated gallery.',
        use_for:
          'Upload product photography, assign it to the right SKU, choose the first customer-facing variant, and check the preview before publishing.',
        handoff:
          'The first variant and its first assigned image become the default shopper presentation. Reordering variants changes what customers see first.',
        instructions: [
          'Select the exact style or color from the variant list.',
          'Upload an image or add its approved URL inside that selected variant.',
          'Keep only images that actually represent the selected SKU.',
          'Use Make first or the order controls when that variant should lead the product.',
          'Confirm the shopper preview before saving the product.',
        ],
        keywords: [
          'photo',
          'image',
          'upload',
          'color',
          'style',
          'thumbnail',
          'hero',
          'make first',
        ],
      },
      {
        id: 'operations-orders',
        title: 'Orders and shipments',
        label: 'Customer fulfillment',
        href: '/admin/orders',
        action: 'Review Orders',
        permission: 'orders:read',
        description:
          'Shows paid customer orders, purchased items, shipping details, payment state, and fulfillment status.',
        use_for:
          'Move an order from New to Processing to Shipped, and export the shipping list when preparing fulfillment.',
        handoff:
          'The status is the team’s shared record. Mark Shipped only after the package has actually left.',
        instructions: [
          'Confirm payment and review the purchased SKUs and shipping address.',
          'Move the order to Processing when fulfillment work begins.',
          'Use the shipping export when preparing labels in a batch.',
          'Mark the order Shipped only after the package has physically left.',
        ],
        keywords: [
          'customer',
          'order',
          'shipping',
          'fulfillment',
          'label',
          'processing',
          'shipped',
        ],
      },
      {
        id: 'operations-inventory',
        title: 'Products & stock',
        label: 'Store availability',
        href: '/admin/products?view=stock',
        action: 'Review Stock',
        permission: 'inventory:read',
        description:
          'Shows each product and sellable variant with its available quantity, low-stock state, standby status, and records that still need setup.',
        use_for:
          'Reconcile physical counts, correct a quantity, edit a product, or place an unavailable option on standby so the store does not oversell it.',
        handoff:
          'Saved quantities become the store’s availability source. Use Orders to manage fulfillment; stock is not a shipment log.',
        instructions: [
          'Open the Stock tab and search by product, option, or SKU.',
          'Use Needs attention to find missing, sold-out, and low-stock variants first.',
          'Enter the physical count and save, or use the plus and minus controls for a quick correction.',
          'Use Move to standby when a variant should temporarily disappear even if units remain.',
          'Only remove a legacy record after confirming it is not attached to a sellable product.',
        ],
        keywords: [
          'quantity',
          'count',
          'sold out',
          'standby',
          'restock',
          'legacy',
          'sku',
          'availability',
        ],
      },
      {
        id: 'operations-people',
        title: 'Hosts and Team',
        label: 'Team reference',
        href: '/admin/people',
        action: 'View Hosts and Team',
        permission: 'people:read',
        description:
          'A directory of host and production profiles, public roles, account connections, and profile completeness.',
        use_for:
          'Confirm who is involved and whether the correct team profile exists before escalating an access or assignment issue.',
        handoff:
          'Profile content and Studio login access are separate. A Studio manager handles account-to-profile connections.',
      },
      {
        id: 'operations-mic-kits',
        title: 'Mic Kit visibility',
        label: 'Shared equipment status',
        href: '/studio/mic-kits',
        action: 'View Mic Kits',
        permission: 'mic_kits:read',
        description:
          'Shows kit availability, requests, reservations, current holders, movement, and tracking information that is safe for the signed-in team.',
        use_for:
          'Coordinate with the mic-kit manager and see whether an upcoming episode has an equipment risk.',
        handoff:
          'This view provides shared visibility. Checkout, labels, and circulation changes remain in the restricted checkout desk.',
      },
      {
        id: 'operations-mic-kit-desk',
        title: 'Mic Kit Checkout',
        label: 'Restricted circulation desk',
        href: '/admin/mic-kits',
        action: 'Open Checkout Desk',
        permission: 'mic_kits:manage',
        description:
          'The operating desk for assigning cases, saving shipping presets, exporting USPS Click-N-Ship data, recording tracking, and checking kits back in.',
        use_for:
          'Use only when you are the person responsible for the physical movement and custody record.',
        handoff:
          'Tracking and holder updates flow back to the shared Mic Kits page for hosts and coordinators.',
      },
      {
        id: 'operations-calendar',
        title: 'Episode Calendar',
        label: 'Production coordination',
        href: '/admin/studios',
        action: 'Open Episode Calendar',
        permission: 'episodes:manage',
        description:
          'Shows the release schedule, package due dates, assigned hosts and producer, completion state, and episodes that are off track.',
        use_for:
          'Create or assign a Studio, check upcoming deadlines, and direct the right person to the shared episode record.',
        handoff:
          'The calendar is the schedule; the individual Episode Studio contains the actual materials and production discussion.',
      },
    ],
    faqs: [
      {
        id: 'operations-faq-sold-out',
        question: 'What is the difference between Sold out and Standby?',
        answer:
          'Sold out means a listed variant has zero units and remains visible so customers can see it may return. Standby intentionally removes the variant or product from the storefront while preserving it in the backend.',
        href: '/admin/products?view=stock',
        action: 'Review Stock',
        permission: 'inventory:read',
        keywords: ['hide', 'visible', 'zero', 'restock', 'sold out', 'standby'],
      },
      {
        id: 'operations-faq-retire',
        question: 'What should I do when a product will never be restocked?',
        answer:
          'Use Archived for the whole product. It disappears from the storefront but remains available for order history. Use Standby when a return is still possible.',
        href: '/admin/products',
        action: 'Open Product Catalog',
        permission: 'products:read',
        keywords: ['archive', 'delete', 'retire', 'never restock', 'disappear'],
      },
      {
        id: 'operations-faq-images',
        question: 'Why is the wrong image showing for a color or style?',
        answer:
          'Open the product in Catalog, select the affected variant, and review the images inside that variant. Remove unrelated assignments, add the correct image, and verify the shopper preview before saving.',
        href: '/admin/products',
        action: 'Manage Product Images',
        permission: 'product_media:update',
        keywords: ['wrong image', 'photo', 'color', 'style', 'variant', 'gallery'],
      },
      {
        id: 'operations-faq-category',
        question: 'How do product categories work?',
        answer:
          'Choose a category from the shared dropdown. Categories form the broad storefront departments, while Collection or maker creates the next grouping inside that department.',
        href: '/admin/products',
        action: 'Open Product Catalog',
        permission: 'products:read',
        keywords: ['headwear', 'apparel', 'category', 'collection', 'maker'],
      },
      {
        id: 'operations-faq-new-sku',
        question: 'Can I create a stock SKU without creating a product?',
        answer:
          'No. Create the product variant in Catalog first so its name, price, images, options, and Stripe identifier stay connected. The Stock view can then begin tracking its count.',
        href: '/admin/products',
        action: 'Create a Product',
        permission: 'products:update',
        keywords: ['manual sku', 'new sku', 'legacy', 'stock only'],
      },
      {
        id: 'operations-faq-live',
        question: 'Why is a saved product not visible in the storefront?',
        answer:
          'Confirm the product is set to Live, the intended variant is listed rather than on standby, and its required name, slug, price, SKU, and images are complete. Draft, Standby, and Archived products remain backend-only.',
        href: '/admin/products',
        action: 'Check Product Status',
        permission: 'products:read',
        keywords: ['missing', 'not visible', 'publish', 'live', 'draft', 'storefront'],
      },
      {
        id: 'operations-faq-legacy',
        question: 'What is a legacy stock record?',
        answer:
          'It is a row in the stock database that no longer matches a catalog variant. If the item is still sellable, create a proper product and SKU. Otherwise remove the legacy row after confirming it is obsolete.',
        href: '/admin/products?view=stock',
        action: 'Review Legacy Records',
        permission: 'inventory:update',
        keywords: ['orphan', 'legacy', 'cleanup', 'old sku', 'record'],
      },
      {
        id: 'operations-faq-payment',
        question: 'Where are Apple Pay, Google Pay, Cash App, and card settings managed?',
        answer:
          'Payment-method availability is managed in Stripe. The checkout displays compatible methods based on the customer’s device, browser, currency, and Stripe configuration; not every method appears for every customer.',
        keywords: [
          'stripe',
          'apple pay',
          'google pay',
          'cash app',
          'card',
          'checkout',
          'payment',
        ],
      },
    ],
  },
  {
    id: 'production',
    audience: 'For producers and Studio managers',
    title: 'Manage episode production',
    summary:
      'Build each Studio, tailor its requirements, review the centralized asset package, and move an episode cleanly into final production.',
    access_permissions: ['episodes:manage'],
    accent: 'production',
    suggested_searches: [
      'create an episode studio',
      'request host changes',
      'connect host access',
      'publish resources',
    ],
    steps: [
      {
        id: 'production-calendar',
        title: 'Episode Calendar',
        label: 'Season control center',
        href: '/studio/manage/episodes',
        action: 'Open Episode Calendar',
        permission: 'episodes:manage',
        description:
          'The season-level view of release dates, host-package deadlines, assignments, delivery health, and review status.',
        use_for:
          'Create an Episode Studio, assign the host and producer, adjust dates, and find submitted or off-track work quickly.',
        handoff:
          'Open the individual Studio for requirements and files; do not try to manage the episode from the calendar card alone.',
      },
      {
        id: 'production-studio',
        title: 'Episode setup and checklist',
        label: 'Flexible production plan',
        href: '/studio/manage/episodes',
        action: 'Choose an Episode Studio',
        permission: 'episodes:manage',
        description:
          'Each Studio is a shared production record. Managers can add, reorder, edit, or remove checklist items to match the episode instead of forcing every show through one rigid sequence.',
        use_for:
          'Set the expected guest information, editorial materials, recording files, images, credits, and special production requirements before the host reaches the handoff stage.',
        handoff:
          'The host sees the same published expectations and can complete the work in the order that fits the episode.',
      },
      {
        id: 'production-sponsor-reads',
        title: 'Sponsor reads and ad spots',
        label: 'Per-episode advertising',
        href: '/studio/manage/sponsor-reads',
        action: 'Open Sponsor Reads',
        permission: 'sponsor_reads:read',
        description:
          'The Sponsor Read Library holds approved script versions. An Episode Studio assignment determines which script applies and whether separate audio is required.',
        use_for:
          'Assign the current read, specify separate-upload versus included-in-recording evidence, and confirm the host supplied the expected audio.',
        handoff:
          'The script version and recording evidence remain attached to the episode so the producer does not have to reconstruct the requirement.',
      },
      {
        id: 'production-assets',
        title: 'Producer handoff and asset package',
        label: 'Central production source',
        href: '/studio/manage/episodes',
        action: 'Review Episode Packages',
        permission: 'episodes:manage',
        description:
          'Uploaded audio, documents, ad spots, and images are grouped under their checklist step and repeated in one clean producer package with labels and retention dates.',
        use_for:
          'Download the files from the Studio, read the host’s asset map and edit directions, and identify missing or expired material before beginning the final build.',
        handoff:
          'S3 is the official delivery point. Files expire 180 days after upload, so move anything needed for long-term archives into the production archive before that date.',
      },
      {
        id: 'production-review',
        title: 'Review, changes, and acceptance',
        label: 'Producer decision',
        href: '/studio/manage/episodes',
        action: 'Open the Review Queue',
        permission: 'episodes:manage',
        description:
          'Submitted packages can be accepted or returned with requested changes. Known gaps stay visible instead of being hidden in a side conversation.',
        use_for:
          'Check guest socials, required sponsor evidence, checklist completion, uploaded assets, and the episode discussion before accepting.',
        handoff:
          'Acceptance locks the delivery outlook as complete. Request Changes reopens the host workflow with the existing package intact.',
      },
      {
        id: 'production-access',
        title: 'Host Access',
        label: 'Account connection',
        href: '/studio/manage/access',
        action: 'Manage Host Access',
        permission: 'studio_access:manage',
        description:
          'Connects a signed-in Cognito account to the correct host or team profile so assignments and producer relationships appear for the right person.',
        use_for:
          'Fix “profile not connected” messages and confirm identity before changing an assignment.',
        handoff:
          'The connection controls who can see assigned Studios; it does not change the public biography or production role by itself.',
      },
      {
        id: 'production-resources',
        title: 'Resource Editor',
        label: 'Published host guidance',
        href: '/studio/manage/resources',
        action: 'Edit the Host Guide',
        permission: 'resources:update',
        description:
          'The editable source for host-facing season guidance, announcements, recording instructions, and approved reference links.',
        use_for:
          'Save a draft, preview exactly what hosts will see, and publish only after links and instructions are current.',
        handoff:
          'Manager notes and inactive links remain private. Publishing updates the shared Host Guide without exposing the staff pathways.',
      },
    ],
    faqs: [
      {
        id: 'production-faq-access',
        question: 'Why can a host sign in but not see an assigned episode?',
        answer:
          'Their Cognito account may not be connected to the correct team profile. Verify the person first, then use Host Access to connect the account and profile.',
        href: '/studio/manage/access',
        action: 'Manage Host Access',
        permission: 'studio_access:manage',
        keywords: ['login', 'missing episode', 'profile not connected', 'cognito'],
      },
      {
        id: 'production-faq-changes',
        question: 'Does Request Changes erase the host package?',
        answer:
          'No. It reopens the workflow with the existing checklist, discussion, and uploaded package intact so the host can address the specific gaps.',
        keywords: ['request changes', 'review', 'erase', 'submission'],
      },
      {
        id: 'production-faq-publish',
        question: 'What is the difference between saving and publishing resources?',
        answer:
          'Save draft preserves manager work without changing what hosts see. Publish makes the reviewed guide available to hosts; manager notes and inactive links remain private.',
        href: '/studio/manage/resources',
        action: 'Edit the Host Guide',
        permission: 'resources:update',
        keywords: ['draft', 'publish', 'host guide', 'resources'],
      },
    ],
  },
];

function hasAnyPermission(permissions, required) {
  return required.some((permission) => permissions.has(permission));
}

export function getStudioResourcePathways(permissionValues = []) {
  const permissions = new Set(
    (Array.isArray(permissionValues) ? permissionValues : []).filter(Boolean)
  );

  return PATHWAYS.filter((pathway) =>
    hasAnyPermission(permissions, pathway.access_permissions)
  ).map((pathway) => ({
    id: pathway.id,
    audience: pathway.audience,
    title: pathway.title,
    summary: pathway.summary,
    accent: pathway.accent,
    suggested_searches: pathway.suggested_searches || [],
    steps: pathway.steps
      .filter(
        (step) => !step.permission || permissions.has(step.permission)
      )
      .map(({ permission, ...step }) => step),
    faqs: (pathway.faqs || [])
      .filter((faq) => !faq.permission || permissions.has(faq.permission))
      .map(({ permission, ...faq }) => faq),
  }));
}

export function getDefaultStudioResourcePath(permissionValues = []) {
  const permissions = new Set(
    (Array.isArray(permissionValues) ? permissionValues : []).filter(Boolean)
  );

  if (
    permissions.has('orders:read') ||
    permissions.has('inventory:read')
  ) {
    return 'operations';
  }
  if (permissions.has('episodes:manage')) return 'production';
  return 'host';
}
