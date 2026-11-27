// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class LHi extends L {
  LHi([String locale = 'hi']) : super(locale);

  @override
  String get appName => 'RentNook';

  @override
  String get tagline => 'पास में, कुछ भी किराये पर';

  @override
  String get benefitFind =>
      'अपने इलाके के लोगों से कैमरा, औज़ार और बहुत कुछ पाएं';

  @override
  String get benefitChat => 'मालिक से सीधे WhatsApp पर बात करें';

  @override
  String get benefitEarn => 'बेकार पड़ा सामान किराये पे दो, कमाई करो';

  @override
  String get continueWithMobile => 'मोबाइल नंबर से आगे बढ़ें';

  @override
  String get justBrowse => 'बस देखना है';

  @override
  String get offlineBanner => 'इंटरनेट नहीं है — सेव किया हुआ दिखा रहे हैं';

  @override
  String get retry => 'फिर से कोशिश करें';

  @override
  String get updateTitle => 'कृपया RentNook अपडेट करें';

  @override
  String get updateBody =>
      'यह वर्ज़न पुराना हो गया है। अपडेट में बस एक मिनट लगेगा।';

  @override
  String get updateButton => 'Play Store पर अपडेट करें';

  @override
  String get enterMobileTitle => 'अपना मोबाइल नंबर डालें';

  @override
  String get mobileHint => '10 अंकों का मोबाइल नंबर';

  @override
  String get ageConsentPrefix => 'मेरी उम्र 18+ है और मैं ';

  @override
  String get terms => 'शर्तें';

  @override
  String get and => ' और ';

  @override
  String get privacyPolicy => 'प्राइवेसी पॉलिसी';

  @override
  String get ageConsentSuffix => 'मानता/मानती हूँ';

  @override
  String get sendOtp => 'OTP भेजें';

  @override
  String get numberNeverShown => 'आपका नंबर कभी सबको नहीं दिखाया जाता';

  @override
  String get invalidMobile => 'सही 10 अंकों का मोबाइल नंबर डालें';

  @override
  String get tooManyAttempts => '10 मिनट बाद फिर कोशिश करें';

  @override
  String get networkError =>
      'कनेक्ट नहीं हो पाया। इंटरनेट देखकर फिर कोशिश करें।';

  @override
  String get otpTitle => '6 अंकों का कोड डालें';

  @override
  String otpSentTo(Object number) {
    return '+91 $number पर भेजा गया';
  }

  @override
  String resendIn(Object seconds) {
    return '$seconds सेकंड में दोबारा भेजें';
  }

  @override
  String get resendCode => 'कोड दोबारा भेजें';

  @override
  String get changeNumber => 'नंबर बदलें';

  @override
  String get verify => 'वेरिफ़ाई करें';

  @override
  String get wrongCode => 'कोड सही नहीं है। SMS दोबारा देखें।';

  @override
  String get codeExpired => 'कोड की समय सीमा ख़त्म हो गई। नया कोड मंगाएं।';

  @override
  String get accountBlocked =>
      'यह अकाउंट ब्लॉक है। गलती लगे तो सपोर्ट से संपर्क करें।';

  @override
  String get profileTitle => 'अपने बारे में बताएं';

  @override
  String get yourName => 'आपका नाम';

  @override
  String get nameHelp => 'आपके सामान पर सिर्फ़ पहला नाम दिखेगा';

  @override
  String get nameInvalid => 'सिर्फ़ अक्षर, स्पेस और डॉट (2–40)';

  @override
  String get yourCity => 'आपका शहर';

  @override
  String get chooseCity => 'शहर चुनें';

  @override
  String get continueLabel => 'आगे बढ़ें';

  @override
  String get searchCity => 'शहर खोजें';

  @override
  String get comingSoon => 'जल्द आ रहा है';

  @override
  String comingSoonTitle(Object city) {
    return 'RentNook अभी $city में नहीं है';
  }

  @override
  String get comingSoonBody =>
      'हम शहर-दर-शहर शुरू कर रहे हैं। नीचे टैप करें, शुरू होते ही बता देंगे।';

  @override
  String get notifyMe => 'शुरू होने पर बताएं';

  @override
  String get waitlistDone => 'हो गया। हम आपको बता देंगे।';

  @override
  String get chooseAnotherCity => 'दूसरा शहर चुनें';

  @override
  String get navHome => 'होम';

  @override
  String get navSearch => 'खोजें';

  @override
  String get navMyItems => 'मेरा सामान';

  @override
  String get navSaved => 'सेव किए';

  @override
  String get navProfile => 'प्रोफ़ाइल';

  @override
  String get signInToContinue => 'आगे बढ़ने के लिए साइन इन करें';

  @override
  String get signInSheetBody =>
      'सामान सेव करने, मालिक से बात करने या किराये पे देने के लिए अकाउंट चाहिए।';

  @override
  String get signIn => 'साइन इन';

  @override
  String get notNow => 'अभी नहीं';

  @override
  String get sessionExpired => 'आपका सेशन ख़त्म हो गया। फिर से साइन इन करें।';

  @override
  String get serverDown => 'सर्वर जवाब नहीं दे रहा। एक मिनट बाद कोशिश करें।';

  @override
  String get searchHint => 'कैमरा, ड्रिल, सोफ़ा खोजें…';

  @override
  String get categories => 'कैटेगरी';

  @override
  String get requestBannerTitle => 'नहीं मिल रहा?';

  @override
  String get requestBannerBody => 'रिक्वेस्ट डालें, पास के मालिक जवाब देंगे';

  @override
  String get sponsored => 'स्पॉन्सर्ड';

  @override
  String latestIn(Object city) {
    return '$city में नया';
  }

  @override
  String get emptyCity => 'इस शहर में अभी कोई सामान नहीं — सबसे पहले आप डालें';

  @override
  String get putOnRent => 'सामान किराये पे दो';

  @override
  String get perDay => '/दिन';

  @override
  String get perWeek => '/हफ़्ता';

  @override
  String get perMonth => '/महीना';

  @override
  String kmAway(Object km) {
    return '$km किमी';
  }

  @override
  String get verified => 'वेरिफ़ाइड';

  @override
  String get filters => 'फ़िल्टर';

  @override
  String get sortNearest => 'सबसे पास';

  @override
  String get sortNewest => 'सबसे नया';

  @override
  String get sortPrice => 'सबसे सस्ता';

  @override
  String resultsCount(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count नतीजे',
      one: '1 नतीजा',
      zero: 'कोई नतीजा नहीं',
    );
    return '$_temp0';
  }

  @override
  String get noResultsTitle => 'इसके लिए कुछ नहीं मिला';

  @override
  String get noResultsBody =>
      'कोई और शब्द आज़माएं, या पास के मालिकों से पूछें।';

  @override
  String get requestThisItem => 'यह सामान मांगें';

  @override
  String get area => 'इलाका';

  @override
  String get anyArea => 'कोई भी इलाका';

  @override
  String get priceRange => 'किराया (₹)';

  @override
  String get min => 'कम से कम';

  @override
  String get max => 'ज़्यादा से ज़्यादा';

  @override
  String get rentPeriod => 'किराया प्रति';

  @override
  String get any => 'कोई भी';

  @override
  String get day => 'दिन';

  @override
  String get week => 'हफ़्ता';

  @override
  String get month => 'महीना';

  @override
  String get verifiedOnly => 'सिर्फ़ वेरिफ़ाइड मालिक';

  @override
  String get apply => 'लागू करें';

  @override
  String get clear => 'हटाएं';

  @override
  String get deposit => 'डिपॉज़िट';

  @override
  String get condition => 'हालत';

  @override
  String get condNEW => 'नया';

  @override
  String get condLIKE_NEW => 'नए जैसा';

  @override
  String get condGOOD => 'अच्छा';

  @override
  String get condFAIR => 'ठीक-ठाक';

  @override
  String memberSince(Object date) {
    return '$date से सदस्य';
  }

  @override
  String get chatOnWhatsapp => 'WhatsApp पर बात करें';

  @override
  String get noLongerAvailable => 'यह सामान अब उपलब्ध नहीं है';

  @override
  String get rentedOutNow => 'अभी किराये पर गया है';

  @override
  String get save => 'सेव करें';

  @override
  String get saved => 'सेव किया';

  @override
  String get share => 'शेयर';

  @override
  String get report => 'रिपोर्ट';

  @override
  String get safetyTitle => 'मिलने से पहले';

  @override
  String get openWhatsapp => 'WhatsApp खोलें';

  @override
  String get whatsappMissing => 'इस फ़ोन में WhatsApp नहीं है।';

  @override
  String get installWhatsapp => 'WhatsApp डाउनलोड करें';

  @override
  String get contactLimit =>
      'आज आपने कई मालिकों से संपर्क किया है। कल फिर कोशिश करें।';

  @override
  String get savedEmpty => 'किसी भी सामान पर दिल दबाकर सेव करें';

  @override
  String get remove => 'हटाएं';

  @override
  String get notAvailableShort => 'उपलब्ध नहीं';

  @override
  String get reportTitle => 'क्या गड़बड़ है?';

  @override
  String get reasonFAKE_ITEM => 'नकली सामान या फ़ोटो';

  @override
  String get reasonADVANCE_PAYMENT => 'एडवांस पैसे मांग रहा है';

  @override
  String get reasonWRONG_PRICE => 'गलत किराया';

  @override
  String get reasonOFFENSIVE => 'आपत्तिजनक';

  @override
  String get reasonOTHER => 'कुछ और';

  @override
  String get addNote => 'नोट लिखें (वैकल्पिक)';

  @override
  String get reportSent => 'बताने के लिए धन्यवाद। हम जांच करेंगे।';

  @override
  String get alreadyReported => 'आप पहले ही रिपोर्ट कर चुके हैं';

  @override
  String get blockOwner => 'इस व्यक्ति को ब्लॉक करें';

  @override
  String get blocked => 'ब्लॉक कर दिया। अब आप एक-दूसरे का सामान नहीं देखेंगे।';

  @override
  String get addItemTitle => 'सामान किराये पे दो';

  @override
  String get editItemTitle => 'सामान बदलें';

  @override
  String get photos => 'फ़ोटो';

  @override
  String get photosHelp => '1 से 8 असली फ़ोटो। पहली फ़ोटो कवर होगी।';

  @override
  String get addPhoto => 'फ़ोटो जोड़ें';

  @override
  String get camera => 'कैमरा';

  @override
  String get gallery => 'गैलरी';

  @override
  String get uploadFailed => 'अपलोड नहीं हुआ';

  @override
  String get title => 'टाइटल';

  @override
  String get titleHint => 'जैसे Canon 1500D, 18-55mm लेंस के साथ';

  @override
  String get category => 'कैटेगरी';

  @override
  String get rentPerDay => 'किराया प्रति दिन (₹)';

  @override
  String get rentPerWeek => 'किराया प्रति हफ़्ता (₹)';

  @override
  String get rentPerMonth => 'किराया प्रति महीना (₹)';

  @override
  String get atLeastOneRent => 'दिन, हफ़्ते या महीने का किराया डालें';

  @override
  String get depositOptional => 'डिपॉज़िट (₹, वैकल्पिक)';

  @override
  String get whatsappNumber => 'WhatsApp नंबर';

  @override
  String get whatsappHelp =>
      'खाली = आपका लॉगिन नंबर। सिर्फ़ \'बात करें\' दबाने पर दिखेगा।';

  @override
  String get description => 'विवरण';

  @override
  String get descriptionHint => 'क्या-क्या साथ है, हालत, कहाँ से लेना है';

  @override
  String get saveDraft => 'ड्राफ़्ट सेव करें';

  @override
  String get submit => 'जमा करें';

  @override
  String get titleLength => 'टाइटल 8–80 अक्षर का हो';

  @override
  String get descLength => 'विवरण 20–1,000 अक्षर का हो';

  @override
  String get priceRangeError => '₹1 से ₹10,00,000 तक पूरे रुपये';

  @override
  String get needPhoto => 'कम से कम एक फ़ोटो जोड़ें';

  @override
  String get contactRemoved =>
      'हमने टेक्स्ट से नंबर या लिंक हटा दिए। लोग WhatsApp बटन से ही संपर्क करेंगे।';

  @override
  String get discardTitle => 'बिना सेव किए छोड़ें?';

  @override
  String get discardBody => 'आपके बदलाव मिट जाएंगे।';

  @override
  String get leave => 'छोड़ें';

  @override
  String get stay => 'रुकें';

  @override
  String get itemLive => 'आपका सामान लाइव है';

  @override
  String get statusDRAFT => 'ड्राफ़्ट';

  @override
  String get statusREVIEW => 'जांच में';

  @override
  String get statusLIVE => 'लाइव';

  @override
  String get statusRENTED_OUT => 'किराये पर';

  @override
  String get statusHIDDEN => 'छिपा हुआ';

  @override
  String get statusPENDING => 'बाकी';

  @override
  String get statusAPPROVED => 'मंज़ूर';

  @override
  String get statusREJECTED => 'नामंज़ूर';

  @override
  String get edit => 'बदलें';

  @override
  String get markRented => 'किराये पर दिया';

  @override
  String get markAvailable => 'फिर उपलब्ध';

  @override
  String get pause => 'रोकें';

  @override
  String get delete => 'डिलीट';

  @override
  String get boost => 'बूस्ट';

  @override
  String get goLive => 'लाइव करें';

  @override
  String get deleteItemTitle => 'यह सामान डिलीट करें?';

  @override
  String get deleteItemBody => 'यह RentNook से हटा दिया जाएगा।';

  @override
  String get cancel => 'रद्द करें';

  @override
  String get myItemsEmpty => 'अपना पहला सामान किराये पे दो';

  @override
  String get noPlanTitle => 'कोई प्लान चालू नहीं';

  @override
  String get noPlanBody => 'प्लान लें ताकि लोग आपका सामान देख सकें।';

  @override
  String get choosePlan => 'प्लान चुनें';

  @override
  String daysLeft(num days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days दिन बाकी',
      one: '1 दिन बाकी',
    );
    return '$_temp0';
  }

  @override
  String get renew => 'रिन्यू करें';

  @override
  String get upgrade => 'अपग्रेड';

  @override
  String get views => 'व्यू';

  @override
  String get whatsappChats => 'WhatsApp चैट';

  @override
  String get itemsLive => 'लाइव सामान';

  @override
  String get overLimit =>
      'प्लान की लिमिट पूरी है, इसलिए कुछ सामान ड्राफ़्ट में है।';

  @override
  String get plansTitle => 'प्लान';

  @override
  String get plansSoon => 'प्लान जल्द आएंगे';

  @override
  String get freePlans => 'फ़्री ऑफ़र';

  @override
  String get paidPlans => 'प्लान';

  @override
  String days(Object days) {
    return '$days दिन';
  }

  @override
  String itemsLimit(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count सामान',
      one: '1 सामान',
    );
    return '$_temp0';
  }

  @override
  String get unlimitedItems => 'असीमित सामान';

  @override
  String get activate => 'चालू करें';

  @override
  String get activateFree => 'फ़्री प्लान चालू करें';

  @override
  String payViaUpi(Object amount) {
    return 'UPI से $amount भरें';
  }

  @override
  String get alreadyUsed => 'आप यह ऑफ़र पहले ही ले चुके हैं';

  @override
  String get couponHint => 'कूपन है?';

  @override
  String get applyCoupon => 'लगाएं';

  @override
  String couponSaved(Object amount) {
    return 'आपकी बचत $amount';
  }

  @override
  String get total => 'कुल';

  @override
  String get waitingApproval => 'रिक्वेस्ट भेज दी। जांच के बाद चालू कर देंगे।';

  @override
  String planActive(Object date) {
    return '$date तक प्लान चालू';
  }

  @override
  String get payTitle => 'UPI से भुगतान';

  @override
  String get payTo => 'भुगतान';

  @override
  String get upiId => 'UPI ID';

  @override
  String get amount => 'रकम';

  @override
  String get paymentFor => 'किसके लिए';

  @override
  String get reference => 'रेफ़रेंस';

  @override
  String get openUpiApp => 'UPI ऐप से भरें';

  @override
  String get scanQr => 'या दूसरे फ़ोन से यह QR स्कैन करें';

  @override
  String get afterPaying => 'भुगतान के बाद वापस आकर UTR डालें।';

  @override
  String get iHavePaid => 'भुगतान कर दिया, UTR डालें';

  @override
  String get noUpiApp =>
      'कोई UPI ऐप नहीं मिला। QR स्कैन करें या ऊपर की UPI ID पर भरें।';

  @override
  String get utrTitle => 'UTR डालें';

  @override
  String get utrLabel => '12 अंकों का UTR / रेफ़रेंस नंबर';

  @override
  String get utrHelp =>
      'UPI ऐप → हिस्ट्री → यह पेमेंट खोलें। इसे UTR, UPI Ref No. या Transaction ID कहते हैं।';

  @override
  String get utrInvalid => 'UTR ठीक 12 अंकों का होना चाहिए';

  @override
  String get attachScreenshot => 'स्क्रीनशॉट लगाएं (वैकल्पिक)';

  @override
  String get screenshotAttached => 'स्क्रीनशॉट लगा दिया';

  @override
  String get utrUsed => 'यह UTR पहले ही इस्तेमाल हो चुका है';

  @override
  String get paymentStatusTitle => 'पेमेंट स्टेटस';

  @override
  String get stepSubmitted => 'जमा किया';

  @override
  String get stepChecking => 'बैंक स्टेटमेंट से मिलान';

  @override
  String get stepApproved => 'मंज़ूर';

  @override
  String get stepRejected => 'कन्फ़र्म नहीं हुआ';

  @override
  String get checkingNote =>
      'हम हर पेमेंट हाथ से जांचते हैं, आमतौर पर 4 कामकाजी घंटों में।';

  @override
  String get submitAgain => 'दोबारा जमा करें';

  @override
  String get myPayments => 'मेरे पेमेंट';

  @override
  String get boostTitle => 'इस सामान को बूस्ट करें';

  @override
  String get boostBody =>
      'बूस्ट किया सामान आपके चुने दिनों तक होम पर स्पॉन्सर्ड में दिखेगा।';

  @override
  String boostDays(Object days) {
    return '$days दिन';
  }

  @override
  String useCredit(Object count) {
    return 'बूस्ट क्रेडिट इस्तेमाल करें ($count बाकी)';
  }

  @override
  String get boostQueued => 'बूस्ट बुक हो गया। स्लॉट खाली होते ही शुरू होगा।';

  @override
  String get boostStarted => 'बूस्ट शुरू';

  @override
  String boostedTill(Object date) {
    return '$date तक बूस्ट';
  }

  @override
  String get notificationsTitle => 'नोटिफ़िकेशन';

  @override
  String get notificationsEmpty =>
      'अभी कुछ नहीं। पेमेंट अपडेट और रिक्वेस्ट यहाँ दिखेंगी।';

  @override
  String get markAllRead => 'सब पढ़ा हुआ';

  @override
  String get pushAskTitle => 'अपडेट चाहिए?';

  @override
  String get pushAskBody =>
      'पेमेंट मंज़ूर होने या किसी को आपका सामान चाहिए होने पर बताएंगे। कोई स्पैम नहीं।';

  @override
  String get allow => 'अनुमति दें';

  @override
  String get editProfile => 'प्रोफ़ाइल बदलें';

  @override
  String get startRenting => 'किराये पे देना शुरू करें';

  @override
  String get myPlan => 'मेरा प्लान';

  @override
  String get language => 'भाषा';

  @override
  String get helpSafety => 'मदद और सुरक्षा';

  @override
  String get termsPrivacy => 'शर्तें और प्राइवेसी';

  @override
  String get deleteMyAccount => 'मेरा अकाउंट डिलीट करें';

  @override
  String get logout => 'लॉग आउट';

  @override
  String get referFriend => 'दोस्त को बुलाएं';

  @override
  String get requests => 'मेरी रिक्वेस्ट';

  @override
  String get getVerified => 'ID वेरिफ़ाई कराएं';

  @override
  String get myShop => 'मेरा शॉप पेज';

  @override
  String get guestProfile => 'आप गेस्ट के रूप में देख रहे हैं';

  @override
  String get deleteTitle => 'अपना अकाउंट डिलीट करें';

  @override
  String get deleteWhat =>
      'डिलीट होगा: आपकी प्रोफ़ाइल, सारा सामान और फ़ोटो, सेव किए आइटम, रिक्वेस्ट, नोटिफ़िकेशन, शॉप पेज और ID फ़ोटो।';

  @override
  String get deleteKept =>
      'रखा जाएगा: टैक्स के लिए ज़रूरी पेमेंट रिकॉर्ड, बिना आपके नाम या नंबर के।';

  @override
  String get deleteTiming =>
      'आपका सामान तुरंत छिप जाएगा। बाकी सब 7 दिन में हट जाएगा।';

  @override
  String get deletePlanWarning =>
      'आपका चालू प्लान ख़त्म हो जाएगा, पैसे वापस नहीं होंगे।';

  @override
  String get reasonOptional => 'वजह (वैकल्पिक)';

  @override
  String get confirmWithOtp => 'OTP से कन्फ़र्म करें';

  @override
  String get deleteFinal => 'अकाउंट डिलीट करें';

  @override
  String get deleteStarted => 'डिलीट शुरू हो गया। आप लॉग आउट हो गए हैं।';

  @override
  String get howItWorks => 'किराया कैसे चलता है';

  @override
  String get howItWorksBody =>
      'सामान ढूंढें, WhatsApp पर मालिक से बात करें और तारीख़, किराया, डिपॉज़िट आपस में तय करें। RentNook कोई कमीशन नहीं लेता और पैसे नहीं रखता।';

  @override
  String get safetyTips => 'सुरक्षा टिप्स';

  @override
  String get faqs => 'सवाल-जवाब';

  @override
  String get contactSupport => 'सपोर्ट से बात करें';

  @override
  String get grievanceOfficer => 'शिकायत अधिकारी';

  @override
  String get referTitle => 'दोस्त को बुलाएं';

  @override
  String referBody(Object days) {
    return 'जब आपका बुलाया दोस्त पहला प्लान लेगा, आपको $days दिन फ़्री मिलेंगे।';
  }

  @override
  String get yourCode => 'आपका कोड';

  @override
  String get shareCode => 'इनवाइट शेयर करें';

  @override
  String rewardsEarned(Object count, Object days) {
    return '$count इनाम · $days दिन मिले';
  }

  @override
  String get haveCode => 'दोस्त से कोड मिला है?';

  @override
  String get codeApplied => 'कोड लग गया';

  @override
  String get shareCardTitle => 'यह सामान शेयर करें';

  @override
  String get whatsappStatus => 'WhatsApp स्टेटस';

  @override
  String get copyLink => 'लिंक कॉपी करें';

  @override
  String get more => 'और';

  @override
  String get linkCopied => 'लिंक कॉपी हो गया';

  @override
  String get requestTitle => 'सामान मांगें';

  @override
  String get requestWhat => 'आपको क्या चाहिए?';

  @override
  String get requestWhatHint => 'जैसे रविवार की शादी के लिए DSLR';

  @override
  String get fromDate => 'कब से';

  @override
  String get toDate => 'कब तक';

  @override
  String get post => 'पोस्ट करें';

  @override
  String requestPosted(Object count) {
    return 'पोस्ट हो गया। पास के $count मालिकों को बताया गया।';
  }

  @override
  String get requestLimit => 'आप दिन में 5 रिक्वेस्ट डाल सकते हैं।';

  @override
  String get requestsEmpty => 'अभी कोई रिक्वेस्ट नहीं';

  @override
  String get replyOnWhatsapp => 'WhatsApp पर जवाब दें';

  @override
  String get nearMeAskTitle => 'दूरी से लगाएं?';

  @override
  String get nearMeAskBody =>
      'हम एक बार आपकी अंदाज़न लोकेशन (करीब 500 मी) से सामान लगाते हैं। यह सेव नहीं होती।';

  @override
  String get useMyLocation => 'मेरी लोकेशन लें';

  @override
  String get locationDenied => 'लोकेशन बंद है, इसलिए शहर के हिसाब से लगाया।';

  @override
  String get idTitle => 'वेरिफ़ाइड निशान पाएं';

  @override
  String get idBody =>
      'सरकारी ID के आगे के हिस्से की साफ़ फ़ोटो डालें। इसे सिर्फ़ हमारी सीनियर टीम देखती है और जांच के 30 दिन बाद डिलीट हो जाती है। ID नंबर कभी नहीं मांगा जाता।';

  @override
  String get uploadId => 'ID फ़ोटो डालें';

  @override
  String get idPending => 'आपकी ID की जांच हो रही है।';

  @override
  String get idVerified => 'आप वेरिफ़ाइड हैं।';

  @override
  String idRejected(Object reason) {
    return 'वेरिफ़ाई नहीं हुआ: $reason';
  }

  @override
  String get shopTitle => 'शॉप पेज';

  @override
  String get shopNeedsBusiness => 'शॉप पेज बिज़नेस प्लान के साथ मिलता है।';

  @override
  String get shopName => 'दुकान का नाम';

  @override
  String get timings => 'समय';

  @override
  String get about => 'परिचय';

  @override
  String get logo => 'लोगो';

  @override
  String get shopSaved => 'शॉप पेज सेव हो गया';

  @override
  String get english => 'English';

  @override
  String get hindi => 'हिंदी';

  @override
  String get somethingWrong => 'कुछ गड़बड़ हुई। फिर से कोशिश करें।';

  @override
  String get galleryTitle => 'कंपोनेंट गैलरी';
}
