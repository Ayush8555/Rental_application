// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class LEn extends L {
  LEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'RentNook';

  @override
  String get tagline => 'Rent anything, near you';

  @override
  String get benefitFind =>
      'Find cameras, tools and more from people in your area';

  @override
  String get benefitChat => 'Talk to the owner directly on WhatsApp';

  @override
  String get benefitEarn => 'Put your unused things on rent and earn';

  @override
  String get continueWithMobile => 'Continue with mobile number';

  @override
  String get justBrowse => 'Just browse';

  @override
  String get offlineBanner => 'No internet — showing saved items';

  @override
  String get retry => 'Try again';

  @override
  String get updateTitle => 'Please update RentNook';

  @override
  String get updateBody =>
      'This version is too old to keep working. The update takes a minute.';

  @override
  String get updateButton => 'Update on Play Store';

  @override
  String get enterMobileTitle => 'Enter your mobile number';

  @override
  String get mobileHint => '10-digit mobile number';

  @override
  String get ageConsentPrefix => 'I am 18+ and agree to the ';

  @override
  String get terms => 'Terms';

  @override
  String get and => ' and ';

  @override
  String get privacyPolicy => 'Privacy Policy';

  @override
  String get ageConsentSuffix => '';

  @override
  String get sendOtp => 'Send OTP';

  @override
  String get numberNeverShown => 'Your number is never shown publicly';

  @override
  String get invalidMobile => 'Enter a valid 10-digit mobile number';

  @override
  String get tooManyAttempts => 'Please try again after 10 minutes';

  @override
  String get networkError =>
      'Could not connect. Check your internet and try again.';

  @override
  String get otpTitle => 'Enter the 6-digit code';

  @override
  String otpSentTo(Object number) {
    return 'Sent to +91 $number';
  }

  @override
  String resendIn(Object seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get resendCode => 'Resend code';

  @override
  String get changeNumber => 'Change number';

  @override
  String get verify => 'Verify';

  @override
  String get wrongCode => 'That code is not right. Please check the SMS.';

  @override
  String get codeExpired => 'This code has expired. Send a new one.';

  @override
  String get accountBlocked =>
      'This account has been blocked. Contact support if you think this is a mistake.';

  @override
  String get profileTitle => 'Tell us about you';

  @override
  String get yourName => 'Your name';

  @override
  String get nameHelp => 'Shown on your items as first name only';

  @override
  String get nameInvalid => 'Use letters, spaces and dots only (2–40)';

  @override
  String get yourCity => 'Your city';

  @override
  String get chooseCity => 'Choose city';

  @override
  String get continueLabel => 'Continue';

  @override
  String get searchCity => 'Search city';

  @override
  String get comingSoon => 'Coming soon';

  @override
  String comingSoonTitle(Object city) {
    return 'RentNook is not in $city yet';
  }

  @override
  String get comingSoonBody =>
      'We are opening city by city. Tap below and we will tell you the day it opens.';

  @override
  String get notifyMe => 'Notify me when it opens';

  @override
  String get waitlistDone => 'Done. We will let you know.';

  @override
  String get chooseAnotherCity => 'Choose another city';

  @override
  String get navHome => 'Home';

  @override
  String get navSearch => 'Search';

  @override
  String get navMyItems => 'My items';

  @override
  String get navSaved => 'Saved';

  @override
  String get navProfile => 'Profile';

  @override
  String get signInToContinue => 'Sign in to continue';

  @override
  String get signInSheetBody =>
      'You need an account to save items, contact owners or put things on rent.';

  @override
  String get signIn => 'Sign in';

  @override
  String get notNow => 'Not now';

  @override
  String get sessionExpired => 'Your session ended. Please sign in again.';

  @override
  String get serverDown =>
      'Our server is not responding. Please try in a minute.';

  @override
  String get searchHint => 'Search cameras, drills, sofas…';

  @override
  String get categories => 'Categories';

  @override
  String get requestBannerTitle => 'Can\'t find it?';

  @override
  String get requestBannerBody => 'Post a request and owners nearby will reply';

  @override
  String get sponsored => 'Sponsored';

  @override
  String latestIn(Object city) {
    return 'Latest in $city';
  }

  @override
  String get emptyCity => 'No items yet in this city — be the first to list';

  @override
  String get putOnRent => 'Put an item on rent';

  @override
  String get perDay => '/day';

  @override
  String get perWeek => '/week';

  @override
  String get perMonth => '/month';

  @override
  String kmAway(Object km) {
    return '$km km';
  }

  @override
  String get verified => 'Verified';

  @override
  String get filters => 'Filters';

  @override
  String get sortNearest => 'Nearest';

  @override
  String get sortNewest => 'Newest';

  @override
  String get sortPrice => 'Lowest price';

  @override
  String resultsCount(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count results',
      one: '1 result',
      zero: 'No results',
    );
    return '$_temp0';
  }

  @override
  String get noResultsTitle => 'Nothing found for this';

  @override
  String get noResultsBody => 'Try another word, or ask owners nearby.';

  @override
  String get requestThisItem => 'Request this item';

  @override
  String get area => 'Area';

  @override
  String get anyArea => 'Any area';

  @override
  String get priceRange => 'Price range (₹)';

  @override
  String get min => 'Min';

  @override
  String get max => 'Max';

  @override
  String get rentPeriod => 'Rent per';

  @override
  String get any => 'Any';

  @override
  String get day => 'Day';

  @override
  String get week => 'Week';

  @override
  String get month => 'Month';

  @override
  String get verifiedOnly => 'Verified owners only';

  @override
  String get apply => 'Apply';

  @override
  String get clear => 'Clear';

  @override
  String get deposit => 'Deposit';

  @override
  String get condition => 'Condition';

  @override
  String get condNEW => 'New';

  @override
  String get condLIKE_NEW => 'Like new';

  @override
  String get condGOOD => 'Good';

  @override
  String get condFAIR => 'Fair';

  @override
  String memberSince(Object date) {
    return 'Member since $date';
  }

  @override
  String get chatOnWhatsapp => 'Chat on WhatsApp';

  @override
  String get noLongerAvailable => 'This item is no longer available';

  @override
  String get rentedOutNow => 'Rented out right now';

  @override
  String get save => 'Save';

  @override
  String get saved => 'Saved';

  @override
  String get share => 'Share';

  @override
  String get report => 'Report';

  @override
  String get safetyTitle => 'Before you meet';

  @override
  String get openWhatsapp => 'Open WhatsApp';

  @override
  String get whatsappMissing => 'WhatsApp is not installed on this phone.';

  @override
  String get installWhatsapp => 'Get WhatsApp';

  @override
  String get contactLimit =>
      'You have contacted many owners today. Try again tomorrow.';

  @override
  String get savedEmpty => 'Tap the heart on any item to save it';

  @override
  String get remove => 'Remove';

  @override
  String get notAvailableShort => 'Not available';

  @override
  String get reportTitle => 'What is wrong?';

  @override
  String get reasonFAKE_ITEM => 'Fake item or photos';

  @override
  String get reasonADVANCE_PAYMENT => 'Asks for advance payment';

  @override
  String get reasonWRONG_PRICE => 'Wrong price';

  @override
  String get reasonOFFENSIVE => 'Offensive';

  @override
  String get reasonOTHER => 'Something else';

  @override
  String get addNote => 'Add a note (optional)';

  @override
  String get reportSent => 'Thanks for telling us. We will check it.';

  @override
  String get alreadyReported => 'You have already reported this';

  @override
  String get blockOwner => 'Block this person';

  @override
  String get blocked => 'Blocked. You will not see each other’s items.';

  @override
  String get addItemTitle => 'Put an item on rent';

  @override
  String get editItemTitle => 'Edit item';

  @override
  String get photos => 'Photos';

  @override
  String get photosHelp => '1 to 8 real photos. The first one is the cover.';

  @override
  String get addPhoto => 'Add photo';

  @override
  String get camera => 'Camera';

  @override
  String get gallery => 'Gallery';

  @override
  String get uploadFailed => 'Upload failed';

  @override
  String get title => 'Title';

  @override
  String get titleHint => 'e.g. Canon 1500D with 18-55mm lens';

  @override
  String get category => 'Category';

  @override
  String get rentPerDay => 'Rent per day (₹)';

  @override
  String get rentPerWeek => 'Rent per week (₹)';

  @override
  String get rentPerMonth => 'Rent per month (₹)';

  @override
  String get atLeastOneRent => 'Add rent per day, week or month';

  @override
  String get depositOptional => 'Deposit (₹, optional)';

  @override
  String get whatsappNumber => 'WhatsApp number';

  @override
  String get whatsappHelp =>
      'Empty = your login number. Only shared when someone taps Chat.';

  @override
  String get description => 'Description';

  @override
  String get descriptionHint =>
      'What is included, its condition, pickup details';

  @override
  String get saveDraft => 'Save draft';

  @override
  String get submit => 'Submit';

  @override
  String get titleLength => 'Title must be 8–80 characters';

  @override
  String get descLength => 'Description must be 20–1,000 characters';

  @override
  String get priceRangeError => 'Use whole rupees from 1 to 10,00,000';

  @override
  String get needPhoto => 'Add at least one photo';

  @override
  String get contactRemoved =>
      'We removed phone numbers or links from the text. People contact you through the WhatsApp button.';

  @override
  String get discardTitle => 'Leave without saving?';

  @override
  String get discardBody => 'Your changes will be lost.';

  @override
  String get leave => 'Leave';

  @override
  String get stay => 'Stay';

  @override
  String get itemLive => 'Your item is live';

  @override
  String get statusDRAFT => 'Draft';

  @override
  String get statusREVIEW => 'Under review';

  @override
  String get statusLIVE => 'Live';

  @override
  String get statusRENTED_OUT => 'Rented out';

  @override
  String get statusHIDDEN => 'Hidden';

  @override
  String get statusPENDING => 'Pending';

  @override
  String get statusAPPROVED => 'Approved';

  @override
  String get statusREJECTED => 'Rejected';

  @override
  String get edit => 'Edit';

  @override
  String get markRented => 'Mark rented';

  @override
  String get markAvailable => 'Mark available';

  @override
  String get pause => 'Pause';

  @override
  String get delete => 'Delete';

  @override
  String get boost => 'Boost';

  @override
  String get goLive => 'Go live';

  @override
  String get deleteItemTitle => 'Delete this item?';

  @override
  String get deleteItemBody => 'It will be removed from RentNook.';

  @override
  String get cancel => 'Cancel';

  @override
  String get myItemsEmpty => 'Put your first item on rent';

  @override
  String get noPlanTitle => 'No active plan';

  @override
  String get noPlanBody => 'Choose a plan so people can see your items.';

  @override
  String get choosePlan => 'Choose a plan';

  @override
  String daysLeft(num days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days days left',
      one: '1 day left',
    );
    return '$_temp0';
  }

  @override
  String get renew => 'Renew';

  @override
  String get upgrade => 'Upgrade';

  @override
  String get views => 'Views';

  @override
  String get whatsappChats => 'WhatsApp chats';

  @override
  String get itemsLive => 'Items live';

  @override
  String get overLimit =>
      'Some items are in Draft because your plan limit is full.';

  @override
  String get plansTitle => 'Plans';

  @override
  String get plansSoon => 'Plans will be available soon';

  @override
  String get freePlans => 'Free offers';

  @override
  String get paidPlans => 'Plans';

  @override
  String days(Object days) {
    return '$days days';
  }

  @override
  String itemsLimit(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$_temp0';
  }

  @override
  String get unlimitedItems => 'Unlimited items';

  @override
  String get activate => 'Activate';

  @override
  String get activateFree => 'Activate free plan';

  @override
  String payViaUpi(Object amount) {
    return 'Pay $amount via UPI';
  }

  @override
  String get alreadyUsed => 'You have already used this offer';

  @override
  String get couponHint => 'Have a coupon?';

  @override
  String get applyCoupon => 'Apply';

  @override
  String couponSaved(Object amount) {
    return 'You save $amount';
  }

  @override
  String get total => 'Total';

  @override
  String get waitingApproval =>
      'Request sent. We will activate it after a quick check.';

  @override
  String planActive(Object date) {
    return 'Plan active till $date';
  }

  @override
  String get payTitle => 'Pay with UPI';

  @override
  String get payTo => 'Paying';

  @override
  String get upiId => 'UPI ID';

  @override
  String get amount => 'Amount';

  @override
  String get paymentFor => 'For';

  @override
  String get reference => 'Reference';

  @override
  String get openUpiApp => 'Pay with a UPI app';

  @override
  String get scanQr => 'Or scan this QR from another phone';

  @override
  String get afterPaying => 'After paying, come back and enter the UTR.';

  @override
  String get iHavePaid => 'I have paid, enter UTR';

  @override
  String get noUpiApp =>
      'No UPI app found. Scan the QR or pay to the UPI ID above.';

  @override
  String get utrTitle => 'Enter UTR';

  @override
  String get utrLabel => '12-digit UTR / reference number';

  @override
  String get utrHelp =>
      'Open your UPI app → payment history → this payment. It is called UTR, UPI Ref No. or Transaction ID.';

  @override
  String get utrInvalid => 'UTR must be exactly 12 digits';

  @override
  String get attachScreenshot => 'Attach screenshot (optional)';

  @override
  String get screenshotAttached => 'Screenshot attached';

  @override
  String get utrUsed => 'This UTR has already been used';

  @override
  String get paymentStatusTitle => 'Payment status';

  @override
  String get stepSubmitted => 'Submitted';

  @override
  String get stepChecking => 'Checking with bank statement';

  @override
  String get stepApproved => 'Approved';

  @override
  String get stepRejected => 'Not confirmed';

  @override
  String get checkingNote =>
      'We check every payment by hand, usually within 4 working hours.';

  @override
  String get submitAgain => 'Submit again';

  @override
  String get myPayments => 'My payments';

  @override
  String get boostTitle => 'Boost this item';

  @override
  String get boostBody =>
      'Boosted items show in the Sponsored row on Home for the days you choose.';

  @override
  String boostDays(Object days) {
    return '$days days';
  }

  @override
  String useCredit(Object count) {
    return 'Use boost credit ($count left)';
  }

  @override
  String get boostQueued =>
      'Boost booked. It starts as soon as a sponsored slot frees up.';

  @override
  String get boostStarted => 'Boost started';

  @override
  String boostedTill(Object date) {
    return 'Boosted till $date';
  }

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsEmpty =>
      'Nothing here yet. Payment updates and requests show up here.';

  @override
  String get markAllRead => 'Mark all read';

  @override
  String get pushAskTitle => 'Get updates?';

  @override
  String get pushAskBody =>
      'We will tell you when a payment is approved or someone needs your item. No spam.';

  @override
  String get allow => 'Allow';

  @override
  String get editProfile => 'Edit profile';

  @override
  String get startRenting => 'Start renting out';

  @override
  String get myPlan => 'My plan';

  @override
  String get language => 'Language';

  @override
  String get helpSafety => 'Help and safety';

  @override
  String get termsPrivacy => 'Terms and Privacy';

  @override
  String get deleteMyAccount => 'Delete my account';

  @override
  String get logout => 'Log out';

  @override
  String get referFriend => 'Refer a friend';

  @override
  String get requests => 'My requests';

  @override
  String get getVerified => 'Get ID verified';

  @override
  String get myShop => 'My shop page';

  @override
  String get guestProfile => 'You are browsing as a guest';

  @override
  String get deleteTitle => 'Delete your account';

  @override
  String get deleteWhat =>
      'Deleted: your profile, all your items and photos, saved items, requests, notifications, shop page and ID photo.';

  @override
  String get deleteKept =>
      'Kept: payment records needed for tax, without your name or number.';

  @override
  String get deleteTiming =>
      'Your items are hidden right away. Everything else is removed within 7 days.';

  @override
  String get deletePlanWarning => 'Your running plan ends and is not refunded.';

  @override
  String get reasonOptional => 'Reason (optional)';

  @override
  String get confirmWithOtp => 'Confirm with OTP';

  @override
  String get deleteFinal => 'Delete account';

  @override
  String get deleteStarted => 'Deletion started. You have been logged out.';

  @override
  String get howItWorks => 'How renting works';

  @override
  String get howItWorksBody =>
      'Find an item, chat with the owner on WhatsApp, and agree dates, rent and deposit between you. RentNook does not take any commission and does not hold money.';

  @override
  String get safetyTips => 'Safety tips';

  @override
  String get faqs => 'Questions';

  @override
  String get contactSupport => 'Contact support';

  @override
  String get grievanceOfficer => 'Grievance officer';

  @override
  String get referTitle => 'Refer a friend';

  @override
  String referBody(Object days) {
    return 'When a friend you invite buys their first plan, you get $days free days.';
  }

  @override
  String get yourCode => 'Your code';

  @override
  String get shareCode => 'Share invite';

  @override
  String rewardsEarned(Object count, Object days) {
    return '$count rewards · $days days earned';
  }

  @override
  String get haveCode => 'Got a code from a friend?';

  @override
  String get codeApplied => 'Code applied';

  @override
  String get shareCardTitle => 'Share this item';

  @override
  String get whatsappStatus => 'WhatsApp Status';

  @override
  String get copyLink => 'Copy link';

  @override
  String get more => 'More';

  @override
  String get linkCopied => 'Link copied';

  @override
  String get requestTitle => 'Request an item';

  @override
  String get requestWhat => 'What do you need?';

  @override
  String get requestWhatHint => 'e.g. DSLR for a wedding on Sunday';

  @override
  String get fromDate => 'From';

  @override
  String get toDate => 'To';

  @override
  String get post => 'Post';

  @override
  String requestPosted(Object count) {
    return 'Posted. $count owners nearby were told.';
  }

  @override
  String get requestLimit => 'You can post 5 requests a day.';

  @override
  String get requestsEmpty => 'No requests yet';

  @override
  String get replyOnWhatsapp => 'Reply on WhatsApp';

  @override
  String get nearMeAskTitle => 'Sort by distance?';

  @override
  String get nearMeAskBody =>
      'We use your approximate location (about 500 m) once to sort items. It is not saved.';

  @override
  String get useMyLocation => 'Use my location';

  @override
  String get locationDenied => 'Location is off, so we sorted by your city.';

  @override
  String get idTitle => 'Get the verified mark';

  @override
  String get idBody =>
      'Upload a clear photo of the front of a government ID. Only our senior team sees it, and it is deleted 30 days after the check. We never ask you to type the ID number.';

  @override
  String get uploadId => 'Upload ID photo';

  @override
  String get idPending => 'We are checking your ID.';

  @override
  String get idVerified => 'You are verified.';

  @override
  String idRejected(Object reason) {
    return 'Not verified: $reason';
  }

  @override
  String get shopTitle => 'Shop page';

  @override
  String get shopNeedsBusiness => 'Shop pages come with the Business plan.';

  @override
  String get shopName => 'Shop name';

  @override
  String get timings => 'Timings';

  @override
  String get about => 'About';

  @override
  String get logo => 'Logo';

  @override
  String get shopSaved => 'Shop page saved';

  @override
  String get english => 'English';

  @override
  String get hindi => 'हिंदी';

  @override
  String get somethingWrong => 'Something went wrong. Please try again.';

  @override
  String get galleryTitle => 'Component gallery';
}
