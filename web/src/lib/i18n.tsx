import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'km' | 'en';

type Dict = Record<string, [km: string, en: string]>;

/** [Khmer, English] — Khmer is the default product language. */
const DICTIONARY: Dict = {
  'app.name': ['NOVA', 'NOVA'],
  'app.tagline': ['កម្មវិធី AI បញ្ចូលលុយ & សេវាឌីជីថល', 'AI top-up & digital services super app'],

  'nav.home': ['ទំព័រដើម', 'Home'],
  'nav.shop': ['ហាង', 'Shop'],
  'nav.assistant': ['NOVA AI', 'NOVA AI'],
  'nav.wallet': ['កាបូប', 'Wallet'],
  'nav.orders': ['ប្រវត្តិ', 'Orders'],
  'nav.admin': ['អ្នកគ្រប់គ្រង', 'Admin'],
  'nav.help': ['ជំនួយ', 'Help'],
  'nav.signIn': ['ចូល', 'Sign in'],
  'nav.signOut': ['ចាកចេញ', 'Sign out'],
  'nav.signUp': ['បើកគណនី', 'Create account'],

  'home.eyebrow': ['ដំណើរការដោយ AI · ធ្វើឡើងសម្រាប់កម្ពុជា', 'AI-native · Built for Cambodia'],
  'home.title1': ['បញ្ចូលលុយ', 'Top up'],
  'home.title2': ['ឆ្លាតជាងមុន', 'smarter'],
  'home.sub': [
    'ជំនួយការ AI ដែលយល់ពីការចំណាយរបស់អ្នក — ណែនាំកញ្ចប់ល្អបំផុត ព្យាករណ៍ការប្រើប្រាស់ និងការពារគណនីអ្នកគ្រប់ពេល។',
    'An AI concierge that understands how you spend — recommending the right bundle, forecasting your usage and guarding every transaction.',
  ],
  'home.ctaShop': ['រកមើលកញ្ចប់', 'Explore bundles'],
  'home.ctaAsk': ['សួរ NOVA', 'Ask NOVA'],
  'home.askPlaceholder': [
    'សួរ NOVA ឧ. "កញ្ចប់អ៊ីនធឺណិតណាល្អសម្រាប់សប្តាហ៍នេះ?"',
    'Ask NOVA e.g. "Which data bundle fits this week?"',
  ],
  'home.statOrders': ['ការបញ្ជាទិញបានបញ្ចប់', 'orders delivered'],
  'home.statDelivery': ['ដឹកជញ្ជូនជាមធ្យម', 'average delivery'],
  'home.statUptime': ['ភាពអាចរកបាន', 'service uptime'],
  'home.statAccuracy': ['ភាពត្រឹមត្រូវណែនាំ', 'rec accuracy'],
  'home.categories': ['ប្រភេទសេវា', 'Service categories'],
  'home.categoriesSub': ['ជ្រើសរើសពីបណ្តាញទូរស័ព្ទ ហ្គេម វិក្កយបត្រ និងច្រើនទៀត', 'Mobile, gaming, bills and more — all in one place'],
  'home.recommended': ['ណែនាំសម្រាប់អ្នក', 'Recommended for you'],
  'home.recommendedSub': ['ជម្រើសដែល AI គណនាពីការប្រើប្រាស់របស់អ្នក', 'Picked by AI from your own spending patterns'],
  'home.howTitle': ['របៀបដែល NOVA ធ្វើការ', 'How NOVA works'],
  'home.step1Title': ['ប្រាប់គោលដៅ', 'Say what you need'],
  'home.step1Body': [
    'សរសេរជាភាសាខ្មែរ ឬអង់គ្លេស — NOVA យល់ទាំងពីរ និងស្គាល់បណ្តាញទូរស័ព្ទទាំងអស់។',
    'Type in Khmer or English — NOVA understands both and knows every carrier.',
  ],
  'home.step2Title': ['ទទួលបានជម្រើសត្រឹមត្រូវ', 'Get grounded picks'],
  'home.step2Body': [
    'គ្រប់ជម្រើសមានតម្លៃពិត ហេតុផលណែនាំ និងការព្យាករណ៍ការប្រើប្រាស់។',
    'Every suggestion carries real prices, a reason, and a usage forecast.',
  ],
  'home.step3Title': ['បង់ប្រាក់ដោយទំនុកចិត្ត', 'Pay with confidence'],
  'home.step3Body': [
    'ការវាយតម្លៃហានិភ័យរាល់ការបញ្ជាទិញ ជាមួយការពន្យល់ច្បាស់លាស់ និងសងប្រាក់ស្វ័យប្រវត្តិ។',
    'Every order is risk-scored with clear explanations and automatic refunds.',
  ],
  'home.featureTitle': ['មិនមែនត្រឹមតែហាងទេ — ជាប្រព័ន្ធឆ្លាតវៃ', 'Not just a store — an intelligence layer'],
  'home.feature1': ['AI ពីរភាសា', 'Bilingual AI'],
  'home.feature1Body': [
    'យល់ភាសាខ្មែរគ្មានចន្លោះ និងស្វែងរកតាមអត្ថន័យ (TF-IDF + n-gram)។',
    'Understands unsegmented Khmer and retrieves semantically (TF-IDF + n-grams).',
  ],
  'home.feature2': ['ហានិភ័យដែលអាចពន្យល់', 'Explainable risk'],
  'home.feature2Body': [
    'គំរូ logistic ជាមួយមេគុណច្បាស់លាស់ — គ្មានការបិទបាំងដោយប្រអប់ខ្មៅ។',
    'A calibrated logistic model exposes every factor — no black-box blocks.',
  ],
  'home.feature3': ['ព្យាករណ៍តម្រូវការ', 'Demand forecasting'],
  'home.feature3Body': [
    'Holt-Winters រួមបញ្ចូល seasonal-naive ដោយវាស់ MAPE ពិតប្រាកដ។',
    'Holt-Winters blended with seasonal-naive, scored on real out-of-sample MAPE.',
  ],
  'home.feature4': ['កាបូប និងពិន្ទុ', 'Wallet & rewards'],
  'home.feature4Body': [
    'ការបង់ប្រាក់ភ្លាមៗ ពិន្ទុរង្វាន់ និងការការពារការឆបោក។',
    'Instant payments, reward points and fraud protection on every order.',
  ],
  'home.trustTitle': ['ភាពជឿជាក់', 'Trusted by'],
  'home.trustLine': ['ហាងលក់ និងភ្នាក់ងារជាង 12,000 នៅទូទាំង ២៥ ខេត្តក្រុង', '12,000+ shops and agents across 25 provinces'],

  'shop.title': ['ហាងសេវាឌីជីថល', 'Digital services shop'],
  'shop.subtitle': ['បញ្ចូលលុយ ទិញកញ្ចប់ បង់វិក្កយបត្រ និងហ្គេម', 'Top-ups, bundles, bills and game credits'],
  'shop.search': ['ស្វែងរកផលិតផល...', 'Search products...'],
  'shop.all': ['ទាំងអស់', 'All'],
  'shop.sortPopular': ['ពេញនិយម', 'Popular'],
  'shop.sortPriceAsc': ['តម្លៃទាប→ខ្ពស់', 'Price: low → high'],
  'shop.sortPriceDesc': ['តម្លៃខ្ពស់→ទាប', 'Price: high → low'],
  'shop.sortValue': ['តម្លៃល្អបំផុត', 'Best value'],
  'shop.results': ['ផលិតផល', 'products'],
  'shop.empty': ['រកមិនឃើញផលិតផល', 'No products found'],
  'shop.emptyBody': ['សូមសាកល្បងពាក្យស្វែងរក ឬប្រភេទផ្សេង។', 'Try a different search term or category.'],
  'shop.buy': ['ទិញឥឡូវ', 'Buy now'],
  'shop.popular': ['ពេញនិយម', 'Popular'],
  'shop.new': ['ថ្មី', 'New'],
  'shop.bestValue': ['តម្លៃល្អបំផុត', 'Best value'],
  'shop.topSeller': ['លក់ដាច់បំផុត', 'Top seller'],

  'checkout.title': ['បញ្ជាក់ការបញ្ជាទិញ', 'Confirm your order'],
  'checkout.recipient': ['លេខទូរស័ព្ទ / ID អ្នកទទួល', 'Recipient number / player ID'],
  'checkout.recipientHint': ['ឧ. 012 345 678 ឬ ID អ្នកលេង', 'e.g. 012 345 678 or your player ID'],
  'checkout.quantity': ['ចំនួន', 'Quantity'],
  'checkout.subtotal': ['សរុបរង', 'Subtotal'],
  'checkout.discount': ['បញ្ចុះតម្លៃដុំ', 'Bulk discount'],
  'checkout.total': ['ត្រូវបង់', 'You pay'],
  'checkout.balance': ['សមតុល្យកាបូប', 'Wallet balance'],
  'checkout.pay': ['បង់ដោយកាបូប', 'Pay with wallet'],
  'checkout.paying': ['កំពុងបង់ប្រាក់...', 'Processing...'],
  'checkout.riskTitle': ['ការវាយតម្លៃហានិភ័យ', 'Risk assessment'],
  'checkout.success': ['ការបញ្ជាទិញជោគជ័យ!', 'Order complete!'],
  'checkout.successBody': [
    'សេវារបស់អ្នកត្រូវបានដឹកជញ្ជូនរួចរាល់។ លេខកូដដឹកជញ្ជូនគឺនៅខាងក្រោម។',
    'Your service has been delivered. Here is your delivery code.',
  ],
  'checkout.deliveryCode': ['លេខកូដដឹកជញ្ជូន', 'Delivery code'],
  'checkout.viewOrders': ['មើលប្រវត្តិ', 'View orders'],
  'checkout.keepShopping': ['បន្តទិញ', 'Keep shopping'],
  'checkout.review': [
    'ការបញ្ជាទិញនេះត្រូវបានពិនិត្យដោយដៃ — យើងនឹងជូនដំណឹងឆាប់ៗ។',
    'This order needs a quick manual review — we will notify you shortly.',
  ],

  'assistant.title': ['NOVA AI Concierge', 'NOVA AI Concierge'],
  'assistant.subtitle': [
    'សួរអំពីកញ្ចប់ ការបង់ប្រាក់ ឬគំរូណែនាំ — NOVA ឆ្លើយជាមួយទិន្នន័យពិត។',
    'Ask about bundles, payments or recommendations — answers grounded in your real data.',
  ],
  'assistant.placeholder': ['សរសេរសាររបស់អ្នក...', 'Type your message...'],
  'assistant.send': ['ផ្ញើ', 'Send'],
  'assistant.thinking': ['NOVA កំពុងគិត...', 'NOVA is thinking...'],
  'assistant.newChat': ['ការសន្ទនាថ្មី', 'New chat'],
  'assistant.history': ['ការសន្ទនា', 'Conversations'],
  'assistant.sources': ['ប្រភព', 'Sources'],
  'assistant.grounded': ['ផ្អែកលើទិន្នន័យពិត', 'Grounded answer'],
  'assistant.intent': ['ចេតនា', 'Intent'],
  'assistant.confidence': ['ភាពជឿជាក់', 'Confidence'],
  'assistant.engine': ['ម៉ាស៊ីន', 'Engine'],
  'assistant.clear': ['សម្អាត', 'Clear'],
  'assistant.prompt1': ['តើកញ្ចប់អ៊ីនធឺណិតណាល្អសម្រាប់ខ្ញុំ?', 'Which data bundle suits me?'],
  'assistant.prompt2': ['សមតុល្យកាបូបរបស់ខ្ញុំប៉ុន្មាន?', 'What is my wallet balance?'],
  'assistant.prompt3': ['បង្ហាញហ្គេមពេញនិយម', 'Show popular game credits'],
  'assistant.prompt4': ['តើការសងប្រាក់ដំណើរការយ៉ាងណា?', 'How do refunds work?'],
  'assistant.emptyTitle': ['ខ្ញុំអាចជួយអ្នកបានយ៉ាងណា?', 'How can I help you today?'],
  'assistant.emptyBody': [
    'សួរខ្ញុំអំពីកញ្ចប់ វិក្កយបត្រ ការបង់ប្រាក់ ឬគំរូណែនាំ។ ខ្ញុំឆ្លើយជាភាសាខ្មែរ និងអង់គ្លេស។',
    'Ask about bundles, bills, payments or recommendations. I answer in Khmer and English.',
  ],
  'assistant.signInPrompt': ['ចូលដើម្បីសន្ទនាជាមួយ NOVA', 'Sign in to chat with NOVA'],

  'wallet.title': ['កាបូប NOVA', 'NOVA wallet'],
  'wallet.subtitle': ['បញ្ចូលប្រាក់ ប្តូរពិន្ទុ និងតាមដានចំណាយ', 'Fund your wallet, redeem points, track spending'],
  'wallet.balance': ['សមតុល្យបច្ចុប្បន្ន', 'Available balance'],
  'wallet.points': ['ពិន្ទុរង្វាន់', 'Reward points'],
  'wallet.pointsValue': ['តម្លៃស្មើ', 'Worth'],
  'wallet.spent': ['ចំណាយសរុប', 'Lifetime spend'],
  'wallet.addFunds': ['បញ្ចូលប្រាក់', 'Add funds'],
  'wallet.amount': ['ចំនួនទឹកប្រាក់', 'Amount'],
  'wallet.method': ['វិធីសាស្ត្រ', 'Payment method'],
  'wallet.deposit': ['បញ្ចូល', 'Deposit'],
  'wallet.depositing': ['កំពុងដំណើរការ...', 'Processing...'],
  'wallet.fee': ['ថ្លៃសេវា', 'Fee'],
  'wallet.credited': ['ទទួលបាន', 'Credited'],
  'wallet.redeem': ['ប្តូរពិន្ទុ', 'Redeem points'],
  'wallet.redeemHint': ['100 ពិន្ទុ = $1', '100 points = $1'],
  'wallet.transactions': ['ប្រតិបត្តិការ', 'Transactions'],
  'wallet.noTx': ['មិនទាន់មានប្រតិបត្តិការ', 'No transactions yet'],
  'wallet.recent': ['ថ្មីៗ', 'Recent activity'],
  'wallet.funded': ['បានបញ្ចូលសរុប', 'Total funded'],

  'orders.title': ['ប្រវត្តិការបញ្ជាទិញ', 'Order history'],
  'orders.subtitle': ['ការបញ្ជាទិញទាំងអស់ ជាមួយលេខកូដដឹកជញ្ជូន', 'Every order with its delivery code'],
  'orders.empty': ['មិនទាន់មានការបញ្ជាទិញ', 'No orders yet'],
  'orders.emptyBody': ['ចាប់ផ្តើមជាមួយកញ្ចប់ពេញនិយមបំផុតរបស់យើង។', 'Start with one of our most popular bundles.'],
  'orders.total': ['ចំណាយសរុប', 'Total spent'],
  'orders.count': ['ការបញ្ជាទិញ', 'orders'],
  'orders.recipient': ['អ្នកទទួល', 'Recipient'],
  'orders.risk': ['ហានិភ័យ', 'Risk'],
  'orders.status.paid': ['បានបង់', 'Paid'],
  'orders.status.review': ['កំពុងពិនិត្យ', 'In review'],
  'orders.status.refunded': ['បានសងប្រាក់', 'Refunded'],
  'orders.status.failed': ['បរាជ័យ', 'Failed'],

  'admin.title': ['ផ្ទាំងអ្នកគ្រប់គ្រង', 'Admin console'],
  'admin.subtitle': ['វិភាគពេលវេលាពិត ព្យាករណ៍ និងការត្រួតពិនិត្យហានិភ័យ', 'Live analytics, forecasting and risk review'],
  'admin.revenue': ['ចំណូលសរុប', 'Total revenue'],
  'admin.orders': ['ការបញ្ជាទិញ', 'Orders'],
  'admin.aov': ['តម្លៃមធ្យម', 'Average order'],
  'admin.users': ['អតិថិជន', 'Customers'],
  'admin.reviewQueue': ['ជួរត្រួតពិនិត្យ', 'Risk queue'],
  'admin.gmvToday': ['GMV ថ្ងៃនេះ', 'GMV today'],
  'admin.forecast': ['ការព្យាករណ៍តម្រូវការ', 'Demand forecast'],
  'admin.forecastSub': ['7 ថ្ងៃខាងមុខ · គំរូជ្រើសដោយស្វ័យប្រវត្តិ', 'Next 7 days · auto-selected model'],
  'admin.mape': ['MAPE', 'MAPE'],
  'admin.baseline': ['Baseline', 'Baseline'],
  'admin.trend': ['និន្នាការ', 'Trend'],
  'admin.confidence': ['ភាពជឿជាក់', 'Confidence'],
  'admin.topProducts': ['ផលិតផលកំពូល', 'Top products'],
  'admin.riskTitle': ['ការត្រួតពិនិត្យហានិភ័យ', 'Risk review queue'],
  'admin.riskSub': ['ការបញ្ជាទិញដែលត្រូវការការសម្រេច', 'Orders that need a decision'],
  'admin.approve': ['អនុម័ត', 'Approve'],
  'admin.reject': ['បដិសេធ & សងប្រាក់', 'Reject & refund'],
  'admin.customers': ['អតិថិជនកំពូល', 'Top customers'],
  'admin.assistant': ['ស្ថិតិជំនួយការ AI', 'AI assistant stats'],
  'admin.questions': ['សំណួរ', 'Questions'],
  'admin.latency': ['ចម្ងាយឆ្លើយតប', 'Avg latency'],
  'admin.intents': ['ចេតនាដែលរកឃើញ', 'Detected intents'],
  'admin.revenueTrend': ['ចំណូល 45 ថ្ងៃ', 'Revenue · last 45 days'],

  'auth.signInTitle': ['សូមស្វាគមន៍ការត្រឡប់មកវិញ', 'Welcome back'],
  'auth.signInSub': ['ចូលដើម្បីបន្តជាមួយ NOVA', 'Sign in to continue with NOVA'],
  'auth.signUpTitle': ['បង្កើតគណនី NOVA', 'Create your NOVA account'],
  'auth.signUpSub': ['ទទួលបានការណែនាំផ្ទាល់ខ្លួន និងពិន្ទុរង្វាន់', 'Get personalised picks and reward points'],
  'auth.email': ['អ៊ីមែល', 'Email'],
  'auth.password': ['ពាក្យសម្ងាត់', 'Password'],
  'auth.name': ['ឈ្មោះពេញ', 'Full name'],
  'auth.signIn': ['ចូល', 'Sign in'],
  'auth.signUp': ['បង្កើតគណនី', 'Create account'],
  'auth.noAccount': ['មិនទាន់មានគណនី?', "Don't have an account?"],
  'auth.haveAccount': ['មានគណនីរួចហើយ?', 'Already have an account?'],
  'auth.demoTitle': ['គណនីសាកល្បង', 'Demo accounts'],
  'auth.demoCustomer': ['អតិថិជន', 'Customer'],
  'auth.demoAdmin': ['អ្នកគ្រប់គ្រង', 'Admin'],
  'auth.useDemo': ['ប្រើប្រាស់', 'Use'],
  'auth.welcomeCredit': ['ឥណទានស្វាគមន៍ $50 សម្រាប់គណនីថ្មី', '$50 welcome credit for new accounts'],
  'auth.toggleLang': ['ភាសាខ្មែរ', 'English'],

  'help.title': ['មជ្ឈមណ្ឌលជំនួយ', 'Help centre'],
  'help.subtitle': ['ចម្លើយរហ័សអំពីការបញ្ជាទិញ ការសងប្រាក់ និងសុវត្ថិភាព', 'Fast answers about orders, refunds and security'],
  'help.ask': ['សួរ NOVA', 'Ask NOVA'],
  'help.contact': ['ទាក់ទងក្រុមការងារ', 'Contact support'],

  'common.loading': ['កំពុងផ្ទុក...', 'Loading...'],
  'common.error': ['មានបញ្ហា', 'Something went wrong'],
  'common.retry': ['ព្យាយាមម្តងទៀត', 'Retry'],
  'common.cancel': ['បោះបង់', 'Cancel'],
  'common.close': ['បិទ', 'Close'],
  'common.copy': ['ចម្លង', 'Copy'],
  'common.copied': ['បានចម្លង', 'Copied'],
  'common.save': ['រក្សាទុក', 'Save'],
  'common.points': ['ពិន្ទុ', 'points'],
  'common.of': ['ក្នុង', 'of'],
  'common.viewAll': ['មើលទាំងអស់', 'View all'],
  'common.optional': ['ស្រេចចិត្ត', 'optional'],
  'common.signInRequired': ['សូមចូលជាមុន', 'Please sign in first'],

  'risk.low': ['ហានិភ័យទាប', 'Low risk'],
  'risk.review': ['ត្រូវពិនិត្យ', 'Needs review'],
  'risk.high': ['ហានិភ័យខ្ពស់', 'High risk'],
  'risk.score': ['ពិន្ទុហានិភ័យ', 'Risk score'],

  'footer.rights': ['រក្សាសិទ្ធិគ្រប់យ៉ាង', 'All rights reserved'],
  'footer.built': ['បង្កើតឡើងដោយ AI · ដំណើរការនៅកម្ពុជា', 'Built with AI · Operated in Cambodia'],
  'footer.product': ['ផលិតផល', 'Product'],
  'footer.company': ['ក្រុមហ៊ុន', 'Company'],
  'footer.legal': ['ច្បាប់', 'Legal'],
};

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  pick: <T extends { nameKm: string; nameEn: string }>(item: T) => string;
  pickText: (km: string, en: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const LANG_KEY = 'nova.lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(LANG_KEY);
    return stored === 'en' || stored === 'km' ? stored : 'km';
  });

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      const entry = DICTIONARY[key];
      let text = entry ? entry[lang === 'km' ? 0 : 1] : key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(replacement));
        }
      }
      return text;
    };

    return {
      lang,
      setLang,
      toggleLang: () => setLangState((current) => (current === 'km' ? 'en' : 'km')),
      t,
      pick: (item) => (lang === 'km' ? item.nameKm : item.nameEn),
      pickText: (km, en) => (lang === 'km' ? km : en),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider');
  return context;
}
