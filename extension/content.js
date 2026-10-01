/* Content script: extracts JSON-LD, Microdata and RDFa from the page, builds a
 * page-content context for suggestions, validates everything, and stores the
 * report in chrome.storage.local for the popup to render. */
(() => {
  'use strict';

  // ---- schema.org knowledge base + validator (inlined at build time) --------
  /* Schema Validator engine — schema.org knowledge base + validation logic. */
(function (global) {
  'use strict';

  // Type hierarchy (child -> parent). Covers commonly used types.
  const PARENT = {
    Thing: null, Action: 'Thing', Intangible: 'Thing', Structure: 'Thing',
    Organization: 'Thing', Person: 'Thing', CreativeWork: 'Thing', Product: 'Thing',
    Event: 'Thing', Place: 'Organization', LocalBusiness: 'Place', MedicalEntity: 'Thing',
    ListItem: 'Intangible', ItemList: 'Intangible', PropertyValue: 'StructuredValue',
    StructuredValue: 'Intangible', Offer: 'Intangible', Demand: 'Offer', AggregateOffer: 'Offer',
    BreadcrumbList: 'ItemList', ImageObject: 'CreativeWork', VideoObject: 'CreativeWork',
    AudioObject: 'CreativeWork', Book: 'CreativeWork', Movie: 'CreativeWork', Recipe: 'CreativeWork',
    Review: 'CreativeWork', Rating: 'Intangible', AggregateRating: 'Rating',
    Answer: 'CreativeWork', Question: 'CreativeWork', Comment: 'CreativeWork',
    WebPageElement: 'CreativeWork', WebPage: 'CreativeWork', WebSite: 'CreativeWork',
    Article: 'CreativeWork', BlogPosting: 'Article', NewsArticle: 'Article',
    TechArticle: 'Article', Blog: 'CreativeWork', HowTo: 'CreativeWork',
    HowToStep: 'ListItem', HowToSection: 'ItemList', FAQPage: 'WebPage', QAPage: 'WebPage',
    JobPosting: 'CreativeWork', LearningResource: 'CreativeWork', Course: 'LearningResource',
    SoftwareApplication: 'CreativeWork', MobileApplication: 'SoftwareApplication',
    WebApplication: 'SoftwareApplication', Dataset: 'CreativeWork', DataCatalog: 'Dataset',
    BusinessEvent: 'Event', FoodEvent: 'Event', MusicEvent: 'Event', SportsEvent: 'Event',
    EducationEvent: 'Event', FoodEstablishment: 'LocalBusiness', Restaurant: 'FoodEstablishment',
    Bakery: 'FoodEstablishment', CafeOrCoffeeShop: 'FoodEstablishment', FastFoodRestaurant: 'FoodEstablishment',
    Store: 'LocalBusiness', RetailStore: 'Store', OnlineStore: 'RetailStore',
    AutoRepair: 'AutomotiveBusiness', AutomotiveBusiness: 'LocalBusiness',
    LodgingBusiness: 'LocalBusiness', Hotel: 'LodgingBusiness', Motel: 'LodgingBusiness',
    RealEstateAgent: 'LocalBusiness', FinancialService: 'LocalBusiness',
    BankOrCreditUnion: 'FinancialService', InsuranceAgency: 'FinancialService',
    MedicalBusiness: 'LocalBusiness', MedicalClinic: 'MedicalBusiness', Clinic: 'MedicalClinic',
    Pharmacy: 'MedicalBusiness', Physician: 'MedicalBusiness', Dentist: 'Physician',
    VeterininaryCare: 'AnimalCare', AnimalCare: 'LocalBusiness', VeterinaryCare: 'AnimalCare',
    PetStore: 'Store', SportingGoodsStore: 'Store', ElectronicsStore: 'Store',
    HomeGoodsStore: 'Store', FurnitureStore: 'Store', GardenStore: 'Store',
    HardwareStore: 'Store', HobbyShop: 'Store', JewelryStore: 'Store',
    LiquorStore: 'Store', MensClothingStore: 'Store', WomenClothingStore: 'Store',
    ShoeStore: 'Store', ToyStore: 'Store', BookStore: 'Store', MusicStore: 'Store',
    BikeStore: 'Store', CameraStore: 'Store', ComputerStore: 'Store',
    ConvenienceStore: 'Store', DepartmentStore: 'Store', DiscountStore: 'Store',
    DivingStore: 'Store', Farm: 'Store', FeedAndSeedStore: 'Store',
    FishingStore: 'Store', GiftShop: 'Store', GunStore: 'Store',
    HealthAndBeautyStore: 'Store', HouseholdStore: 'Store',
    LuggageStore: 'Store', OfficeEquipmentStore: 'Store', OutletStore: 'Store',
    PawnShop: 'Store', Perfumery: 'Store', SportingGoodsStoreX: 'Store',
    StationeryStore: 'Store', TireShop: 'Store', ToolAndDieStore: 'Store',
    TrophyShop: 'Store', WholesaleStore: 'Store',
    PostalAddress: 'ContactPoint', ContactPoint: 'StructuredValue',
    GeoCoordinates: 'StructuredValue', MonetaryAmount: 'StructuredValue',
    QuantitativeValue: 'StructuredValue', PriceSpecification: 'StructuredValue',
    UnitPriceSpecification: 'PriceSpecification', OpeningHoursSpecification: 'StructuredValue',
    NutritionInformation: 'StructuredValue', Brand: 'Organization', Service: 'Intangible',
    SpeakableSpecification: 'Intangible', SiteNavigationElement: 'WebPageElement',
    AdministrativeArea: 'Place', City: 'AdministrativeArea', State: 'AdministrativeArea',
    Country: 'AdministrativeArea', Landform: 'Place', LandmarksOrHistoricalBuildings: 'Place',
    Residence: 'Place', TouristAttraction: 'Place', PublicSwimmingPool: 'Place',
    MedicalCondition: 'MedicalEntity', Drug: 'MedicalEntity', Hospital: 'MedicalEntity',
    MedicalProcedure: 'MedicalEntity', MedicalTest: 'MedicalEntity', MedicalTherapy: 'MedicalEntity',
    AnatomicalStructure: 'MedicalEntity', MedicalSign: 'MedicalEntity',
    MedicalSymptom: 'MedicalEntity', MedicalCause: 'MedicalEntity',
    MedicalDevice: 'MedicalEntity', MedicalGuideline: 'MedicalEntity',
    MedicalIndication: 'MedicalEntity', MedicalRiskFactor: 'MedicalEntity',
    MedicalStudy: 'MedicalEntity', MedicalTrial: 'MedicalStudy',
    MedicineSystem: 'MedicalEntity', MedicalSpecialty: 'MedicalEntity',
    Immunotherapy: 'MedicalTherapy', Vaccine: 'MedicalDevice', DrugClass: 'MedicalEntity',
    Substance: 'MedicalEntity', ChemicalSubstance: 'Substance'
  };

  // Required properties per type (Google rich-results expectations).
  const REQUIRED = {
    Article: ['headline', 'author', 'datePublished', 'image'],
    NewsArticle: ['headline', 'datePublished'], BlogPosting: ['headline'],
    HowTo: ['name', 'step'], FAQPage: ['mainEntity'], Question: ['name', 'acceptedAnswer'],
    BreadcrumbList: ['itemListElement'], ListItem: ['position'],
    Event: ['name', 'startDate'],
    JobPosting: ['title', 'datePosted', 'validThrough', 'employmentType', 'hiringOrganization', 'jobLocation'],
    Organization: ['name'], LocalBusiness: ['name'], Person: ['name'], Product: ['name'],
    Offer: ['price'], AggregateOffer: ['offerCount'], AggregateRating: ['ratingValue'],
    Review: ['itemReviewed'], Recipe: ['name', 'recipeIngredient', 'recipeInstructions', 'image'],
    VideoObject: ['name', 'uploadDate', 'thumbnailUrl', 'contentUrl'],
    ImageObject: ['contentUrl'], SoftwareApplication: ['name'], WebSite: ['name', 'url'],
    Place: ['name'], Course: ['name'], Dataset: ['name']
  };

  // Recommended properties → warnings when missing.
  const RECOMMENDED = {
    Article: ['dateModified', 'publisher'], NewsArticle: ['author', 'publisher'],
    Event: ['location', 'endDate', 'image', 'description'],
    Product: ['image', 'description', 'sku', 'brand', 'offers'],
    Offer: ['priceCurrency', 'availability', 'url'],
    Restaurant: ['servesCuisine', 'priceRange', 'address', 'telephone'],
    LocalBusiness: ['address', 'telephone', 'image', 'url'],
    Person: ['jobTitle', 'url'], Review: ['reviewRating', 'author', 'datePublished'],
    Recipe: ['prepTime', 'cookTime', 'totalTime', 'recipeYield', 'nutrition'],
    VideoObject: ['description', 'duration'],
    SoftwareApplication: ['operatingSystem', 'applicationCategory', 'offers'],
    JobPosting: ['baseSalary', 'experienceRequirements'], WebSite: ['publisher'],
    Organization: ['url', 'logo'], Course: ['description', 'provider']
  };

  // Common mistakes → correction hints.
  const PROPERTY_ALIASES = {
    headLine: 'headline', Headline: 'headline', pubDate: 'datePublished',
    datepublished: 'datePublished', pricecurrency: 'priceCurrency', pricerange: 'priceRange',
    openinghours: 'openingHoursSpecification or openingHours', itemlistelement: 'itemListElement',
    mainentity: 'mainEntity', steps: 'step (HowTo) or recipeInstructions (Recipe)',
    ingredients: 'recipeIngredient', rating: 'aggregateRating or review',
    phone: 'telephone', email_address: 'email', img: 'image', thumbnail: 'thumbnailUrl'
  };

  // Properties valid on every type (schema.org Thing properties + JSON-LD keywords).
  const GLOBAL_PROPS = new Set([
    '@context', '@type', '@id', '@value', '@language', '@graph', '@reverse', '@nest',
    '@list', '@set', '@included', '@explicit', '@none', '@vocab', '@base', '@container', '@direction',
    'additionalType', 'alternateName', 'description', 'disambiguatingDescription', 'identifier',
    'image', 'mainEntityOfPage', 'name', 'sameAs', 'subjectOf', 'url'
  ]);

  // Per-type property pools (walked up the hierarchy during validation).
  const TYPE_PROPS = {
    Thing: [],
    CreativeWork: ['author', 'headline', 'datePublished', 'dateModified', 'publisher', 'keywords', 'license', 'citation', 'inLanguage', 'wordCount', 'articleSection', 'articleBody', 'isPartOf', 'about', 'mentions', 'character', 'timeRequired', 'accessMode', 'accessibilityFeature', 'translationOfWork', 'workTranslation', 'abstract', 'audience', 'award', 'contentRating', 'contentLocation', 'creator', 'contributor', 'editor', 'illustrator', 'translator', 'provider', 'sponsor', 'funder', 'producer', 'director', 'actor', 'musicBy', 'genre', 'recordedAt', 'locationCreated', 'material', 'workExample', 'exampleOfWork', 'associatedMedia', 'thumbnail', 'version', 'interactionStatistic', 'speakable', 'mainEntity', 'dateCreated', 'dateDeleted', 'accessAPI', 'accessibilityControl', 'accessibilityHazard', 'accessibilitySummary', 'alternativeHeadline', 'educationalUse', 'interactivityType', 'learningResourceType', 'teaches'],
    Article: ['pageStart', 'pageEnd', 'pagination', 'speaksAs', 'sectionId', 'subsection'],
    Person: ['affiliation', 'jobTitle', 'worksFor', 'alumniOf', 'knowsAbout', 'email', 'telephone', 'address', 'birthDate', 'deathDate', 'gender', 'nationality', 'honorificPrefix', 'honorificSuffix', 'memberOf', 'knowsLanguage', 'colleague', 'children', 'parents', 'siblings', 'spouse', 'follows', 'contactPoints', 'homeLocation', 'workLocation', 'hasCredential'],
    Organization: ['legalName', 'foundingDate', 'founder', 'logo', 'numberOfEmployees', 'department', 'employee', 'member', 'contactPoint', 'areaServed', 'slogan', 'parentOrganization', 'subOrganization', 'taxID', 'vatID', 'naics', 'duns', 'email', 'telephone', 'address', 'sameAs', 'department', 'subOrganization'],
    Place: ['address', 'geo', 'hasMap', 'containingPlace', 'containedInPlace', 'country', 'timezone', 'maximumAttendeeCapacity', 'email', 'telephone', 'aggregateRating', 'availableLanguage', 'publicAccess', 'tourBookingPage', 'openingHoursSpecification', 'amenityFeature', 'isAcceptableFor'],
    LocalBusiness: ['openingHoursSpecification', 'openingHours', 'priceRange', 'currenciesAccepted', 'paymentAccepted', 'acceptsReservations', 'serviceArea', 'amenityFeature', 'branchCode', 'aggregateRating', 'review', 'geo', 'address', 'telephone', 'email'],
    Product: ['sku', 'mpn', 'gtin8', 'gtin12', 'gtin13', 'gtin14', 'gtin', 'brand', 'category', 'color', 'material', 'weight', 'dimensions', 'depth', 'height', 'width', 'offers', 'aggregateRating', 'review', 'additionalProperty', 'productionDate', 'purchaseDate', 'model', 'manufacturer', 'audience', 'releaseDate', 'isRelatedTo', 'isSimilarTo', 'hasVariant', 'logo', 'name', 'description', 'url', 'image'],
    Offer: ['price', 'priceCurrency', 'availability', 'itemOffered', 'validFrom', 'validThrough', 'eligibleQuantity', 'eligibleRegion', 'businessFunction', 'priceValidUntil', 'priceSpecification', 'shippingDetails', 'hasMerchantReturnPolicy', 'seller', 'url', 'category', 'availabilityStarts', 'availabilityEnds', 'inventoryLevel', 'sku', 'mpn', 'gtin'],
    AggregateOffer: ['lowPrice', 'highPrice', 'offerCount'],
    AggregateRating: ['ratingValue', 'bestRating', 'worstRating', 'ratingCount', 'reviewCount'],
    Review: ['reviewBody', 'reviewRating', 'itemReviewed', 'positiveNotes', 'negativeNotes', 'name', 'author', 'datePublished'],
    Event: ['startDate', 'endDate', 'eventAttendanceMode', 'eventStatus', 'location', 'organizer', 'performer', 'offers', 'typicalAgeRange', 'isFamilyFriendly', 'previousStartDate', 'virtualLocation', 'attendee', 'contributor', 'duration', 'inLanguage', 'isAccessibleForFree', 'eventSeries', 'name', 'description', 'image'],
    Recipe: ['recipeCategory', 'recipeCuisine', 'recipeIngredient', 'recipeInstructions', 'recipeYield', 'prepTime', 'cookTime', 'totalTime', 'nutrition', 'suitableForDiet', 'cookingMethod', 'dietFeatures', 'menu', 'name', 'image', 'author', 'datePublished'],
    HowTo: ['step', 'tool', 'supply', 'estimatedCost', 'totalTime', 'yield', 'video', 'name', 'description', 'image'],
    HowToStep: ['text', 'itemListElement', 'url', 'name'],
    HowToSection: ['itemListElement', 'name'],
    FAQPage: ['mainEntity'],
    Question: ['text', 'acceptedAnswer', 'answer', 'upvoteCount', 'downvoteCount', 'suggestedAnswer', 'answerCount', 'commentCount', 'comment', 'name'],
    Answer: ['text', 'author', 'dateCreated', 'url', 'upvoteCount'],
    BreadcrumbList: ['itemListElement', 'itemListOrder', 'numberOfItems'],
    ItemList: ['itemListElement', 'itemListOrder', 'numberOfItems'],
    ListItem: ['item', 'position', 'url', 'name'],
    JobPosting: ['title', 'datePosted', 'validThrough', 'employmentType', 'hiringOrganization', 'jobLocation', 'experienceRequirements', 'educationRequirements', 'responsibilities', 'workHours', 'salaryCurrency', 'baseSalary', 'industry', 'occupationalCategory', 'quantity', 'applicantLocationRequirements', 'jobLocationType', 'totalJobOpenings', 'directApply', 'skillsRequirement', 'testingRequirement', 'description', 'validFor'],
    VideoObject: ['contentUrl', 'embedUrl', 'thumbnailUrl', 'uploadDate', 'duration', 'trailer', 'transcript', 'caption', 'requiresSubscription', 'videoQuality', 'publication', 'name', 'description', 'expires', 'hasPart'],
    ImageObject: ['contentUrl', 'thumbnailUrl', 'caption', 'representativeOfPage', 'exifData', 'copyrightYear', 'copyrightHolder', 'creditText', 'provider', 'license', 'acquireLicensePage', 'inLanguage'],
    AudioObject: ['contentUrl', 'embedUrl', 'transcript', 'caption', 'duration', 'downloadUrl'],
    SoftwareApplication: ['softwareVersion', 'applicationCategory', 'applicationSubCategory', 'operatingSystem', 'downloadUrl', 'installUrl', 'featureList', 'permissions', 'memoryRequirements', 'processorRequirements', 'storageRequirements', 'softwareRequirements', 'fileFormat', 'fileSize', 'screenshot', 'softwareHelp', 'termsOfService', 'endUserAgreement', 'contentUrl', 'dateModified', 'name', 'offers', 'aggregateRating', 'review', 'browserRequirements', 'dependencies', 'supportAnnotations'],
    WebSite: ['potentialAction', 'relatedLink', 'mainEntity', 'alternateName', 'name', 'url'],
    WebPage: ['breadcrumb', 'lastReviewed', 'mainContentOfPage', 'primaryImageOfPage', 'relatedLink', 'reviewedBy', 'significantLink', 'specialty', 'apisApplied', 'dataFeedSize', 'expressionOf', 'inLanguage', 'isPartOf', 'lastReviewed', 'mainEntity', 'missingLink', 'primaryImageOfPage', 'relatedLink', 'reviewedById'],
    ContactPoint: ['contactType', 'email', 'telephone', 'faxNumber', 'areaServed', 'availableLanguage', 'hoursAvailable', 'productSupported'],
    PostalAddress: ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry', 'postOfficeBoxNumber', 'address'],
    MonetaryAmount: ['amount', 'currency', 'minValue', 'maxValue', 'value', 'unitText', 'unitCode'],
    GeoCoordinates: ['latitude', 'longitude', 'elevation', 'address'],
    OpeningHoursSpecification: ['dayOfWeek', 'opens', 'closes', 'validFrom', 'validThrough'],
    Brand: ['logo', 'name', 'url'],
    NutritionInformation: ['calories', 'carbohydrateContent', 'cholesterolContent', 'fatContent', 'fiberContent', 'proteinContent', 'saturatedFatContent', 'sodiumContent', 'sugarContent', 'transFatContent', 'servingSize', 'cookingMethod'],
    Dataset: ['variableMeasured', 'measurementTechnique', 'spatialCoverage', 'temporalCoverage', 'distribution', 'catalog', 'datasetDescription', 'sparseDataset', 'name', 'description'],
    Course: ['courseCode', 'coursePrerequisites', 'educationalLevel', 'learningResourceType', 'teaches', 'hasCourseInstance', 'provider', 'name', 'description'],
    MedicalEntity: ['medicineSystem', 'specialization', 'possibleTreatment'],
    MedicalCondition: ['symptom', 'causeOf', 'associatedAnatomy', 'epidemiology', 'naturalProgression', 'possibleComplication', 'riskFactor', 'signOrSymptom', 'stage', 'typicalTest', 'prevention', 'prognosis'],
    Drug: ['drugClass', 'activeIngredient', 'dosageForm', 'prescriptionStatus', 'routeOfAdministration', 'nonProprietaryName'],
    Action: ['actionStatus', 'agent', 'instrument', 'object', 'participant', 'result', 'startTime', 'endTime', 'target', 'location'],
    Service: ['serviceType', 'provider', 'areaServed', 'availableChannel', 'serviceAudience', 'serviceOutput', 'termsOfService'],
    Book: ['bookEdition', 'bookFormat', 'isbn', 'numberOfPages', 'illustrator'],
    Movie: ['trailer', 'duration', 'contentRating', 'actor', 'director', 'musicBy', 'producer'],
    WebPageElement: ['cssSelector', 'xpath'],
    SpeakableSpecification: ['cssSelector', 'xpath'],
    MedicalBusiness: ['availableService', 'medicalSpecialty', 'hospitalAffiliation'],
    MedicalClinic: ['availableService', 'medicalSpecialty'],
    Physician: ['availableService', 'hospitalAffiliation', 'medicalSpecialty'],
    Dentist: ['availableService'],
    Intangible: [], StructuredValue: [],
    Rating: ['author', 'bestRating', 'worstRating', 'ratingExplanation', 'ratingValue', 'reviewAspect'],
    Comment: ['text', 'upvoteCount', 'parentItem', 'answerCount'],
    Demand: ['availableAtOrFrom', 'acceptedPaymentMethod'],
    Immunotherapy: [], Vaccine: ['vaccinePurpose', 'targetPopulation', 'vaccineBooster', 'vaccineType'],
    MedicalProcedure: ['howPerformed', 'postoperativeDetail'],
    MedicalTest: ['testArchitecture', 'referenceNormalValue', 'marker'],
    MedicalTherapy: ['contraindication', 'adverseOutcome', 'dosageForm', 'mechanismOfAction', 'therapyDirection'],
    MedicalStudy: ['studyDesign', 'statistic', 'population'],
    Hospital: ['bed', 'hospitalAffiliation', 'availableService'],
    MedicalSpecialty: [], MedicalSign: [], MedicalSymptom: [], MedicalCause: [],
    MedicalDevice: [], MedicalGuideline: [], MedicalIndication: [], MedicalRiskFactor: [],
    AnatomicalStructure: ['bloodSupply', 'muscleAction', 'nerve', 'relatedTo'],
    Substance: ['molecularFormula', 'solubility', 'meltingPoint', 'boilingPoint', 'density'],
    ChemicalSubstance: ['chemicalRole', 'smiles', 'inChI', 'iupacName'],
    AdministrativeArea: ['containedIn', 'continent', 'countryCode'],
    City: [], State: [], Country: [], Landform: [], TouristAttraction: ['isAccessibleForFree'],
    PropertyValue: ['propertyID', 'unitCode', 'unitText', 'value', 'valueReference'],
    QuantitativeValue: ['value', 'minValue', 'maxValue', 'unitCode', 'unitText', 'valueReference'],
    PriceSpecification: ['price', 'priceCurrency', 'minPrice', 'maxPrice', 'valueAddedTaxIncluded', 'priceType', 'priceComponent', 'unitCode', 'unitText', 'referenceQuantity'],
    GeoCoordinates_: [], DataCatalog: ['dataset'],
    Blog: ['name'], BlogPosting: [], TechArticle: ['dependencies', 'prerequisites', 'sampleType'],
    QAPage: ['mainEntity'], WebApplication: ['browserRequirements'],
    MobileApplication: ['carrier', 'devicesupport_'],
    VeterinaryCare: [], AnimalCare: [], PetStore: [], Museum: 'Place' === null ? [] : ['isAccessibleForFree'],
    Library: ['isAccessibleForFree'], School: [], CollegeOrUniversity: [], EducationalOrganization: [],
    GovernmentOrganization: [], NGO: [], SportsTeam: [], MusicGroup: [], TelevisionStation: [],
    RadioStation: [], Airline: [], Corporation: [], ElectionOrganization: [],
    SearchAction: ['query_input'], QueryAction: [], ViewAction: [], ListenAction: [],
    ReadAction: [], WriteAction: [], CreateAction: [], InstallAction: [], DownloadAction: []
  };
  delete TYPE_PROPS.GeoCoordinates_;
  delete TYPE_PROPS.MobileApplication.devicesupport_;
  if (!Array.isArray(TYPE_PROPS.Museum)) TYPE_PROPS.Museum = ['isAccessibleForFree'];

  // Expected value kinds for selected properties (strict-mode checks).
  const PROP_EXPECT = {
    price: 'number', lowPrice: 'number', highPrice: 'number', amount: 'number',
    ratingValue: 'number', bestRating: 'number', worstRating: 'number',
    ratingCount: 'integer', reviewCount: 'integer', position: 'integer',
    latitude: 'number', longitude: 'number', offerCount: 'integer',
    minValue: 'number', maxValue: 'number', wordCount: 'integer', numberOfPages: 'integer',
    url: 'url', contentUrl: 'url', thumbnailUrl: 'url', embedUrl: 'url', downloadUrl: 'url',
    installUrl: 'url', sameAs: 'url', hasMap: 'url',
    datePublished: 'date', dateModified: 'date', startDate: 'date', endDate: 'date',
    uploadDate: 'date', validFrom: 'date', validThrough: 'date', dateCreated: 'date',
    priceValidUntil: 'date', expires: 'date', expiry: 'date', previousStartDate: 'date',
    email: 'email', telephone: 'phone', faxNumber: 'phone'
  };
  // Numeric props that are also legitimately given as strings ("price": "19.99")
  const NUMERIC_OK_AS_STRING = new Set(['price', 'lowPrice', 'highPrice', 'amount', 'ratingValue', 'bestRating', 'worstRating', 'minValue', 'maxValue']);

  const ALL_PROPS = new Set(GLOBAL_PROPS);
  Object.values(TYPE_PROPS).forEach((a) => Array.isArray(a) && a.forEach((p) => ALL_PROPS.add(p)));
  Object.values(REQUIRED).forEach((a) => a.forEach((p) => ALL_PROPS.add(p)));
  Object.values(RECOMMENDED).forEach((a) => a.forEach((p) => ALL_PROPS.add(p)));
  Object.keys(PROP_EXPECT).forEach((p) => ALL_PROPS.add(p));

  function isTypeKnown(t) { return Object.prototype.hasOwnProperty.call(PARENT, t); }
  function inheritsFrom(type, anc) { let c = type; while (c && PARENT[c] !== undefined) { if (c === anc) return true; c = PARENT[c]; } return false; }
  function validPropsFor(type) {
    const set = new Set(GLOBAL_PROPS);
    let cur = type;
    while (cur && PARENT[cur] !== undefined) {
      (TYPE_PROPS[cur] || []).forEach((p) => set.add(p));
      (REQUIRED[cur] || []).forEach((p) => set.add(p));
      (RECOMMENDED[cur] || []).forEach((p) => set.add(p));
      cur = PARENT[cur];
    }
    return set;
  }

  const JSONLD_KEYS = new Set(['@context', '@type', '@id', '@reverse', '@graph', '@nest', '@list', '@set', '@included', '@explicit', '@none', '@vocab', '@base', '@container', '@direction', '@value', '@language']);
  function flattenNode(node) {
    const types = []; const props = {};
    const t = node['@type'];
    if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.push(x));
    else if (typeof t === 'string') types.push(t);
    Object.keys(node).forEach((k) => {
      if (JSONLD_KEYS.has(k)) return;
      const vals = Array.isArray(node[k]) ? node[k] : [node[k]];
      props[k] = (props[k] || []).concat(vals);
    });
    return { types, props };
  }

  const ISO_DATE = /^\d{4}-\d{2}(-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?)?$/;
  const URLISH = /^(https?|mailto|tel|ftp):|^\/|^\.|^#|^www\./i;

  function checkValueShape(key, v, push, path, strict) {
    const kind = PROP_EXPECT[key];
    if (!kind) return;
    const lvl = strict ? 'warning' : 'info';
    if (typeof v === 'number') {
      if (kind === 'url' || kind === 'date' || kind === 'email' || kind === 'phone') {
        push(lvl, `"${key}" should be a string (${kind}) but got number ${v}.`, path);
      }
      return;
    }
    if (typeof v !== 'string') return;
    if (kind === 'url' && !URLISH.test(v)) push(lvl, `"${key}" value "${v.slice(0, 60)}" does not look like a URL.`, path);
    else if (kind === 'date' && !ISO_DATE.test(v)) push(lvl, `"${key}" should be ISO 8601 (e.g. 2025-01-31), got "${v.slice(0, 40)}".`, path);
    else if (kind === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) push(lvl, `"${key}" value "${v.slice(0, 60)}" does not look like an email address.`, path);
    else if (kind === 'phone' && !/[0-9]{3}/.test(v)) push(lvl, `"${key}" value "${v.slice(0, 60)}" does not look like a phone number.`, path);
    else if ((kind === 'number' || kind === 'integer') && !NUMERIC_OK_AS_STRING.has(key) && !/^-?\d+(\.\d+)?$/.test(v)) push(lvl, `"${key}" expects a number, got "${v.slice(0, 40)}".`, path);
  }

  function validateJsonLdItem(item, strict, sourceLabel) {
    const issues = [];
    const push = (level, message, path) => issues.push({ level, message, path: path || '' });
    const seen = new WeakSet();

    const walk = (raw, prefix) => {
      if (raw == null) { push('error', 'Empty/null node.', prefix); return; }
      if (Array.isArray(raw)) { raw.forEach((r, i) => walk(r, `${prefix}[${i}]`)); return; }
      if (typeof raw !== 'object') { push('error', `Expected an object, got ${typeof raw}.`, prefix); return; }
      if (seen.has(raw)) return; // guard against circular refs from microdata nesting
      seen.add(raw);
      if (raw['@graph']) {
        walk(raw['@graph'], prefix + '@graph.');
        const rest = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== '@graph'));
        if (Object.keys(rest).length) inspect(flattenNode(rest), prefix);
        return;
      }
      inspect(flattenNode(raw), prefix);
    };

    const inspect = (flat, prefix) => {
      const nodePath = prefix + (flat.types[0] || '(node)');
      if (!flat.types.length) push('info', 'Node without @type — treated as generic Thing.', nodePath);
      flat.types.forEach((t) => {
        if (!isTypeKnown(t)) push(strict ? 'error' : 'warning', `Unknown schema.org type "${t}".`, nodePath);
      });
      const primary = flat.types.find(isTypeKnown) || flat.types[0];
      const validSet = primary ? validPropsFor(primary) : ALL_PROPS;
      Object.keys(flat.props).forEach((key) => {
        if (!validSet.has(key)) {
          const alias = PROPERTY_ALIASES[key] || PROPERTY_ALIASES[key.toLowerCase()];
          push(strict ? 'error' : 'warning',
            `Property "${key}" is not expected on ${primary || 'Thing'}.${alias ? ' Did you mean ' + alias + '?' : ''}`,
            `${nodePath}.${key}`);
        }
        (flat.props[key] || []).forEach((v) => {
          if (v && typeof v === 'object') walk(v, `${nodePath}.${key}:`);
          else checkValueShape(key, v, push, `${nodePath}.${key}`, strict);
        });
      });
      if (primary && isTypeKnown(primary)) {
        const have = new Set(Object.keys(flat.props));
        (REQUIRED[primary] || []).forEach((rp) => { if (!have.has(rp)) push(strict ? 'error' : 'warning', `Missing required property "${rp}" for ${primary}.`, nodePath); });
        (RECOMMENDED[primary] || []).forEach((rp) => { if (!have.has(rp)) push('warning', `Recommended property "${rp}" missing for ${primary}.`, nodePath); });
      }
    };

    (Array.isArray(item) ? item : [item]).forEach((n) => walk(n, ''));
    return { format: sourceLabel || 'JSON-LD', issues, types: collectTypes(item) };
  }

  function collectTypes(item) {
    const out = [];
    const seen = new WeakSet();
    const visit = (n) => {
      if (!n) return;
      if (Array.isArray(n)) return n.forEach(visit);
      if (typeof n !== 'object') return;
      if (seen.has(n)) return;
      seen.add(n);
      const t = n['@type'];
      if (t) (Array.isArray(t) ? t : [t]).forEach((x) => typeof x === 'string' && out.push(x));
      Object.keys(n).forEach((k) => { if (!k.startsWith('@')) visit(n[k]); });
    };
    visit(item);
    return [...new Set(out)];
  }

  // ---- Suggestions (heuristic, no AI) ----------------------------------------
  // ctx: { title, headings[], textSample, url, origin, pathDepth, existingTypes[],
  //        hasProducts, hasEvents, hasRecipe, hasHowTo, hasFaq, hasJobs, hasVideos,
  //        hasRatings, hasAddresses, hasDates }
  function buildSuggestions(ctx) {
    const s = [];
    const have = new Set(ctx.existingTypes || []);
    const add = (type, reason, snippet) => s.push({ type, reason, snippet });
    const hay = (((ctx.title || '') + ' ' + (ctx.headings || []).join(' '))).toLowerCase();

    if (ctx.hasDates && /(news|article|blog|post|journal|press|report)/.test(hay) && !have.has('NewsArticle') && !have.has('Article'))
      add('NewsArticle', 'Headings/date patterns suggest an article page.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'NewsArticle', headline: ctx.title || 'Page title',
        image: ['https://example.com/image.jpg'], datePublished: guessDate(ctx.textSample) || '2025-01-01T00:00:00+00:00',
        author: { '@type': 'Person', name: 'Author Name' },
        publisher: { '@type': 'Organization', name: 'Publisher Name', logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' } }
      }));
    if (ctx.hasProducts && !have.has('Product'))
      add('Product', 'Price patterns detected on the page.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'Product',
        name: (ctx.headings && ctx.headings[0]) || 'Product name', image: ['https://example.com/product.jpg'],
        description: 'Short product description', sku: 'SKU-001', brand: { '@type': 'Brand', name: 'Brand' },
        offers: { '@type': 'Offer', price: guessPrice(ctx.textSample) || '19.99', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: ctx.url || 'https://example.com/product' }
      }));
    if (ctx.hasEvents && !have.has('Event'))
      add('Event', 'Date ranges plus venue/address cues suggest an event.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'Event', name: (ctx.headings && ctx.headings[0]) || 'Event name',
        startDate: '2025-06-01T18:00:00+00:00', endDate: '2025-06-01T21:00:00+00:00',
        location: { '@type': 'Place', name: 'Venue', address: { '@type': 'PostalAddress', streetAddress: '123 Main St', addressLocality: 'City', addressRegion: 'ST', postalCode: '00000', addressCountry: 'US' } },
        image: ['https://example.com/event.jpg'], eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        offers: { '@type': 'Offer', url: ctx.url || 'https://example.com/event', price: '25.00', priceCurrency: 'USD' }
      }));
    if (ctx.hasRecipe && !have.has('Recipe'))
      add('Recipe', 'Ingredients/steps phrasing detected.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'Recipe', name: (ctx.headings && ctx.headings[0]) || 'Recipe name',
        image: ['https://example.com/dish.jpg'], author: { '@type': 'Person', name: 'Chef' }, datePublished: '2025-01-01',
        prepTime: 'PT15M', cookTime: 'PT30M', totalTime: 'PT45M', recipeYield: '4 servings',
        recipeIngredient: ['ingredient one', 'ingredient two'],
        recipeInstructions: [{ '@type': 'HowToStep', name: 'Mix', text: 'Step one…' }, { '@type': 'HowToStep', name: 'Bake', text: 'Step two…' }]
      }));
    if (ctx.hasHowTo && !have.has('HowTo'))
      add('HowTo', '"Step N" / "how to" patterns found.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to …',
        step: [{ '@type': 'HowToStep', name: 'Step 1', text: '…' }, { '@type': 'HowToStep', name: 'Step 2', text: '…' }]
      }));
    const faqSignal = ctx.hasFaq || /(frequently asked questions?)/i.test(hay);
    if (faqSignal && !have.has('FAQPage'))
      add('FAQPage', 'Question/answer pairs detected.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [{ '@type': 'Question', name: 'Question?', acceptedAnswer: { '@type': 'Answer', text: 'Answer.' } }]
      }));
    if (ctx.hasJobs && !have.has('JobPosting'))
      add('JobPosting', 'Hiring-related wording detected.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Job title',
        description: 'Job description…', datePosted: '2025-01-01', validThrough: '2025-12-31',
        employmentType: 'FULL_TIME', hiringOrganization: { '@type': 'Organization', name: 'Company' },
        jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'City', addressCountry: 'US' } },
        baseSalary: { '@type': 'MonetaryAmount', currency: 'USD', value: { '@type': 'QuantitativeValue', minValue: 50000, maxValue: 70000, unitText: 'YEAR' } }
      }));
    if (ctx.hasVideos && !have.has('VideoObject'))
      add('VideoObject', 'Embedded video detected.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'VideoObject', name: 'Video title',
        description: 'Video description', thumbnailUrl: ['https://example.com/thumb.jpg'],
        uploadDate: '2025-01-01T00:00:00+00:00', contentUrl: 'https://example.com/video.mp4',
        embedUrl: 'https://example.com/embed', duration: 'PT2M30S'
      }));
    if (ctx.hasRatings && !have.has('AggregateRating') && !have.has('Review'))
      add('AggregateRating', 'Star/rating values visible on page.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'AggregateRating',
        ratingValue: guessRating(ctx.textSample) || '4.5', bestRating: '5', worstRating: '1',
        ratingCount: '120', reviewCount: '45'
      }));
    if (ctx.hasAddresses && !have.has('LocalBusiness') && !have.has('Restaurant') && !have.has('Hotel'))
      add('LocalBusiness', 'Physical address & phone present.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'LocalBusiness', name: ctx.title || 'Business name',
        image: ['https://example.com/store.jpg'],
        address: { '@type': 'PostalAddress', streetAddress: '123 Main St', addressLocality: 'City', addressRegion: 'ST', postalCode: '00000', addressCountry: 'US' },
        telephone: '+1-555-000-0000', email: 'info@example.com', url: ctx.url || 'https://example.com',
        openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '17:00' }],
        geo: { '@type': 'GeoCoordinates', latitude: 37.4, longitude: -122.1 }
      }));
    if (!have.has('BreadcrumbList') && ctx.pathDepth >= 2)
      add('BreadcrumbList', 'URL has multiple path segments but no breadcrumbs.', jsonldSnippet({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: (ctx.origin || 'https://example.com') + '/' },
          { '@type': 'ListItem', position: 2, name: 'Section', item: (ctx.origin || 'https://example.com') + '/section/' }
        ]
      }));
    if (!have.has('Organization') && !have.has('WebSite') && !ctx.hasProducts && !ctx.hasEvents && !ctx.hasRecipe)
      add('WebSite + Organization', 'No site-level markup found.', jsonldSnippet({
        '@context': 'https://schema.org', '@graph': [
          { '@type': 'WebSite', name: ctx.title || 'Site name', url: ctx.url || 'https://example.com' },
          { '@type': 'Organization', name: 'Organization name', url: ctx.url || 'https://example.com', logo: 'https://example.com/logo.png', sameAs: ['https://twitter.com/handle'] }
        ]
      }));
    return s;
  }

  function jsonldSnippet(obj) {
    return '<script type="application/ld+json">\n' + JSON.stringify(obj, null, 2) + '\n</scr' + 'ipt>';
  }
  function guessDate(text) {
    const m = (text || '').match(/\b(20\d{2}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2})\b/i);
    if (!m) return null;
    const d = new Date(m[1]);
    return isNaN(d) ? null : d.toISOString();
  }
  function guessPrice(text) { const m = (text || '').match(/[$€£]\s?(\d+(?:[.,]\d{1,2})?)/); return m ? m[1].replace(',', '.') : null; }
  function guessRating(text) { const m = (text || '').match(/(\d(?:\.\d)?)\s*(?:\/\s*5|out of 5|stars?|★)/i); return m ? m[1] : null; }

  const api = { PARENT, REQUIRED, RECOMMENDED, TYPE_PROPS, GLOBAL_PROPS, ALL_PROPS, PROPERTY_ALIASES, PROP_EXPECT, isTypeKnown, inheritsFrom, validPropsFor, validateJsonLdItem, buildSuggestions, jsonldSnippet, guessDate, guessPrice, guessRating };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SchemaValidator = api;
})(typeof self !== 'undefined' ? self : this);


  const V = self.SchemaValidator;

  // ---------- JSON-LD extraction ----------
  function extractJsonLd() {
    const items = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el, i) => {
      const raw = el.textContent || '';
      let parsed = null; let parseError = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e1) {
        // Tolerate common junk: HTML comments wrapping, trailing commas
        try {
          const cleaned = raw.replace(/^\s*<!--[\s\S]*?-->\s*$/g, (m) => m.replace(/<!--|-->/g, ''))
            .replace(/,\s*([}\]])/g, '$1');
          parsed = JSON.parse(cleaned);
          parseError = 'Parsed after removing comments/trailing commas — clean this up.';
        } catch (e2) {
          parseError = e2.message;
        }
      }
      items.push({ kind: 'JSON-LD', index: i, raw, parsed, parseError });
    });
    return items;
  }

  // ---------- Microdata extraction ----------
  const SCHEMA_URL_RE = /^https?:\/\/schema\.org\/(.+)$/i;
  function microdataItems() {
    const scopes = [...document.querySelectorAll('[itemscope]')];
    return scopes.map((scope, i) => {
      const typeUrl = scope.getAttribute('itemtype') || '';
      const m = typeUrl.match(SCHEMA_URL_RE);
      const type = m ? m[1] : (typeUrl ? typeUrl : null);
      const props = {};
      // direct itemprop children of THIS scope (not nested scopes)
      const refIds = (scope.getAttribute('itemref') || '').split(/\s+/).filter(Boolean);
      const refEls = refIds.map((id) => document.getElementById(id)).filter(Boolean);
      const propEls = [...scope.querySelectorAll('[itemprop]'), ...refEls];
      propEls.forEach((el) => {
        // skip elements owned by an inner itemscope
        const parentScope = el.parentElement && el.parentElement.closest('[itemscope]');
        if (parentScope && parentScope !== scope) return;
        const name = el.getAttribute('itemprop');
        let value;
        if (el.hasAttribute('itemscope')) {
          value = microdataNodeToLd(el);
        } else if (el.tagName === 'META') {
          value = el.getAttribute('content') || '';
        } else if (el.tagName === 'TIME') {
          value = el.getAttribute('datetime') || el.textContent.trim();
        } else if (el.tagName === 'IMG') {
          value = el.getAttribute('src') || '';
        } else if (el.tagName === 'A' || el.tagName === 'LINK') {
          value = el.getAttribute('href') || '';
        } else if (el.tagName === 'DATA') {
          value = el.getAttribute('value') || el.textContent.trim();
        } else {
          value = el.textContent.trim();
        }
        if (props[name] === undefined) props[name] = value;
        else if (Array.isArray(props[name])) props[name].push(value);
        else props[name] = [props[name], value];
      });
      const node = { '@type': type || 'Thing', ...props };
      if (scope.hasAttribute('itemid')) node['@id'] = scope.getAttribute('itemid');
      return { kind: 'Microdata', index: i, typeUrl, node, element: scope };
    });
  }
  function microdataNodeToLd(scope) {
    const typeUrl = scope.getAttribute('itemtype') || '';
    const m = typeUrl.match(SCHEMA_URL_RE);
    const type = m ? m[1] : 'Thing';
    const props = {};
    scope.querySelectorAll('[itemprop]').forEach((el) => {
      const ps = el.parentElement && el.parentElement.closest('[itemscope]');
      if (ps && ps !== scope) return;
      const name = el.getAttribute('itemprop');
      let value;
      if (el.hasAttribute('itemscope')) value = microdataNodeToLd(el);
      else if (el.tagName === 'META') value = el.getAttribute('content') || '';
      else if (el.tagName === 'TIME') value = el.getAttribute('datetime') || el.textContent.trim();
      else if (el.tagName === 'IMG') value = el.getAttribute('src') || '';
      else if (el.tagName === 'A' || el.tagName === 'LINK') value = el.getAttribute('href') || '';
      else value = el.textContent.trim();
      if (props[name] === undefined) props[name] = value;
      else if (Array.isArray(props[name])) props[name].push(value);
      else props[name] = [props[name], value];
    });
    return { '@type': type, ...props };
  }

  // ---------- RDFa extraction ----------
  function rdfaNodeToLd(el) {
    const typeofAttr = el.getAttribute('typeof') || '';
    let type = null;
    if (typeofAttr) {
      const first = typeofAttr.split(/\s+/)[0];
      const m = first.match(SCHEMA_URL_RE);
      if (m) type = m[1];
      else if (/^[A-Z]/.test(first) && !first.includes('/')) type = first;
      else if (first.includes('schema.org')) type = first.split('/').pop();
    }
    const props = {};
    const addProp = (node) => {
      const rawName = node.getAttribute('property');
      if (!rawName) return;
      const name = rawName.replace(/^schema:/i, '').replace(SCHEMA_URL_RE_SRC, '');
      if (!name || name.includes(':')) return;
      let value;
      if (node.hasAttribute('typeof')) value = rdfaNodeToLd(node);
      else value = node.getAttribute('content') || node.textContent.trim();
      if (props[name] === undefined) props[name] = value;
      else if (Array.isArray(props[name])) props[name].push(value);
      else props[name] = [props[name], value];
    };
    if (el.hasAttribute('property')) addProp(el);
    el.querySelectorAll('[property]').forEach((p) => {
      const owner = p.parentElement && p.parentElement.closest('[typeof]');
      if (owner && owner !== el) return; // belongs to a deeper entity
      addProp(p);
    });
    return { '@type': type || 'Thing', ...props };
  }

  function rdfaItems() {
    const nodes = [...document.querySelectorAll('[typeof],[about][property],[resource][property]')];
    // keep only top-level entities (skip elements inside another [typeof])
    const tops = nodes.filter((el) => {
      const parent = el.parentElement && el.parentElement.closest('[typeof]');
      return !parent;
    });
    return tops.map((el, i) => {
      const node = rdfaNodeToLd(el);
      return { kind: 'RDFa', index: i, typeUrl: el.getAttribute('typeof') || '', node, element: el };
    });
  }
  const SCHEMA_URL_RE_SRC = /^https?:\/\/schema\.org\//i;

  function documentBodyText() {
    // jsdom & older engines lack innerText — approximate visible text
    const clone = document.body ? document.body.cloneNode(true) : null;
    if (!clone) return '';
    clone.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ');
  }

  // ---------- Page context for suggestions ----------
  function buildPageContext(existingTypes) {
    const text = ((document.body && (document.body.innerText || documentBodyText())) || '').slice(0, 20000);
    const headings = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.textContent.trim()).filter(Boolean).slice(0, 20);
    let pathDepth = 0, origin = location.origin;
    try { pathDepth = location.pathname.split('/').filter(Boolean).length; } catch (e) {}
    const lower = text.toLowerCase();
    return {
      title: document.title || '',
      headings,
      textSample: text.slice(0, 5000),
      url: location.href, origin, pathDepth,
      existingTypes,
      hasDates: /\b20\d{2}-\d{2}-\d{2}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/i.test(text),
      hasProducts: /[$€£]\s?\d+([.,]\d{1,2})?\b/.test(text) && /(price|buy|add to cart|in stock|product)/i.test(lower),
      hasEvents: /(event|ticket|register|agenda|venue)/i.test(lower) && /\b(20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text),
      hasRecipe: /(ingredients|directions|preparation|recipe|instructions)/i.test(lower) && /(steps|bake|cook|mix|prep)/i.test(lower),
      hasHowTo: /(step\s*\d|how to)/i.test(lower),
      hasFaq: /(faq|frequently asked|questions)/i.test(lower),
      hasJobs: /(job|career|hiring|apply now|position open|full-time|part-time)/i.test(lower),
      hasVideos: !!document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]'),
      hasRatings: /(\d(?:\.\d)?)\s*(\/\s*5|out of 5|stars?|★)/i.test(text),
      hasAddresses: /\d{1,5}\s+\w+(\s\w+)*\s+(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Way)\b/i.test(text) && /\b\d{5}(-\d{4})?\b/.test(text)
    };
  }

  // ---------- Run & store ----------
  function run(strict) {
    if (strict === undefined) strict = false; // popup re-validates from raw data anyway
    const results = [];
    const allTypes = new Set();

    extractJsonLd().forEach((it) => {
      if (it.parseError && !it.parsed) {
        results.push({ kind: 'JSON-LD', index: it.index, label: `JSON-LD block #${it.index + 1}`, types: [], issues: [{ level: 'error', message: `Invalid JSON: ${it.parseError}`, path: '' }], raw: it.raw });
        return;
      }
      const r = V.validateJsonLdItem(it.parsed, strict, 'JSON-LD');
      if (it.parseError) r.issues.unshift({ level: 'warning', message: it.parseError, path: '' });
      r.types.forEach((t) => allTypes.add(t));
      results.push({ kind: 'JSON-LD', index: it.index, label: `JSON-LD block #${it.index + 1}${r.types.length ? ': ' + r.types.join(', ') : ''}`, types: r.types, issues: r.issues, raw: it.raw });
    });

    microdataItems().forEach((it) => {
      const r = V.validateJsonLdItem(it.node, strict, 'Microdata');
      r.types.forEach((t) => allTypes.add(t));
      const loc = describeElement(it.element);
      results.push({ kind: 'Microdata', index: it.index, label: `Microdata item ${loc}${it.type ? ': ' + it.type : ''}`, types: r.types, issues: r.issues, raw: JSON.stringify(it.node, null, 2) });
    });

    rdfaItems().forEach((it) => {
      const r = V.validateJsonLdItem(it.node, strict, 'RDFa');
      r.types.forEach((t) => allTypes.add(t));
      const loc = describeElement(it.element);
      results.push({ kind: 'RDFa', index: it.index, label: `RDFa item ${loc}${it.node['@type'] ? ': ' + it.node['@type'] : ''}`, types: r.types, issues: r.issues, raw: JSON.stringify(it.node, null, 2) });
    });

    const ctx = buildPageContext([...allTypes]);
    const suggestions = V.buildSuggestions(ctx);

    const errors = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'error').length, 0);
    const warnings = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'warning').length, 0);

    const report = {
      url: location.href, title: document.title, generatedAt: Date.now(),
      counts: { jsonld: results.filter((r) => r.kind === 'JSON-LD').length, microdata: results.filter((r) => r.kind === 'Microdata').length, rdfa: results.filter((r) => r.kind === 'RDFa').length },
      results, suggestions, summary: { errors, warnings }
    };

    try {
      chrome.storage.local.set({ [`report:${tabKey()}`]: report }, () => {
        if (chrome.runtime.lastError) return;
        try { chrome.runtime.sendMessage({ type: 'validation-summary', errors, warnings }); } catch (e) {}
      });
    } catch (e) { /* extension context invalidated */ }
  }

  function tabKey() {
    // storage key based on URL; popup reads by current tab URL
    return location.href.replace(/#.*$/, '');
  }

  function describeElement(el) {
    if (!el || !el.tagName) return '';
    let s = `<${el.tagName.toLowerCase()}`;
    if (el.id) s += `#${el.id}`;
    else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/)[0];
    return s + '>';
  }

  // Re-run when DOM mutates significantly (debounced); respect saved mode.
  let t = null;
  let currentStrict = false;
  const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => run(currentStrict), 800); });
  function start() {
    try {
      chrome.storage.local.get(['mode'], (d) => {
        currentStrict = d && d.mode === 'strict';
        run(currentStrict);
      });
    } catch (e) { run(false); }
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
