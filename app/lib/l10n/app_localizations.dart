import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of L
/// returned by `L.of(context)`.
///
/// Applications need to include `L.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: L.localizationsDelegates,
///   supportedLocales: L.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the L.supportedLocales
/// property.
abstract class L {
  L(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static L of(BuildContext context) {
    return Localizations.of<L>(context, L)!;
  }

  static const LocalizationsDelegate<L> delegate = _LDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'RentNook'**
  String get appName;

  /// No description provided for @tagline.
  ///
  /// In en, this message translates to:
  /// **'Rent anything, near you'**
  String get tagline;

  /// No description provided for @benefitFind.
  ///
  /// In en, this message translates to:
  /// **'Find cameras, tools and more from people in your area'**
  String get benefitFind;

  /// No description provided for @benefitChat.
  ///
  /// In en, this message translates to:
  /// **'Talk to the owner directly on WhatsApp'**
  String get benefitChat;

  /// No description provided for @benefitEarn.
  ///
  /// In en, this message translates to:
  /// **'Put your unused things on rent and earn'**
  String get benefitEarn;

  /// No description provided for @continueWithMobile.
  ///
  /// In en, this message translates to:
  /// **'Continue with mobile number'**
  String get continueWithMobile;

  /// No description provided for @justBrowse.
  ///
  /// In en, this message translates to:
  /// **'Just browse'**
  String get justBrowse;

  /// No description provided for @offlineBanner.
  ///
  /// In en, this message translates to:
  /// **'No internet — showing saved items'**
  String get offlineBanner;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retry;

  /// No description provided for @updateTitle.
  ///
  /// In en, this message translates to:
  /// **'Please update RentNook'**
  String get updateTitle;

  /// No description provided for @updateBody.
  ///
  /// In en, this message translates to:
  /// **'This version is too old to keep working. The update takes a minute.'**
  String get updateBody;

  /// No description provided for @updateButton.
  ///
  /// In en, this message translates to:
  /// **'Update on Play Store'**
  String get updateButton;

  /// No description provided for @enterMobileTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your mobile number'**
  String get enterMobileTitle;

  /// No description provided for @mobileHint.
  ///
  /// In en, this message translates to:
  /// **'10-digit mobile number'**
  String get mobileHint;

  /// No description provided for @ageConsentPrefix.
  ///
  /// In en, this message translates to:
  /// **'I am 18+ and agree to the '**
  String get ageConsentPrefix;

  /// No description provided for @terms.
  ///
  /// In en, this message translates to:
  /// **'Terms'**
  String get terms;

  /// No description provided for @and.
  ///
  /// In en, this message translates to:
  /// **' and '**
  String get and;

  /// No description provided for @privacyPolicy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get privacyPolicy;

  /// No description provided for @ageConsentSuffix.
  ///
  /// In en, this message translates to:
  /// **''**
  String get ageConsentSuffix;

  /// No description provided for @sendOtp.
  ///
  /// In en, this message translates to:
  /// **'Send OTP'**
  String get sendOtp;

  /// No description provided for @numberNeverShown.
  ///
  /// In en, this message translates to:
  /// **'Your number is never shown publicly'**
  String get numberNeverShown;

  /// No description provided for @invalidMobile.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 10-digit mobile number'**
  String get invalidMobile;

  /// No description provided for @tooManyAttempts.
  ///
  /// In en, this message translates to:
  /// **'Please try again after 10 minutes'**
  String get tooManyAttempts;

  /// No description provided for @networkError.
  ///
  /// In en, this message translates to:
  /// **'Could not connect. Check your internet and try again.'**
  String get networkError;

  /// No description provided for @otpTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code'**
  String get otpTitle;

  /// No description provided for @otpSentTo.
  ///
  /// In en, this message translates to:
  /// **'Sent to +91 {number}'**
  String otpSentTo(Object number);

  /// No description provided for @resendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend in {seconds}s'**
  String resendIn(Object seconds);

  /// No description provided for @resendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get resendCode;

  /// No description provided for @changeNumber.
  ///
  /// In en, this message translates to:
  /// **'Change number'**
  String get changeNumber;

  /// No description provided for @verify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get verify;

  /// No description provided for @wrongCode.
  ///
  /// In en, this message translates to:
  /// **'That code is not right. Please check the SMS.'**
  String get wrongCode;

  /// No description provided for @codeExpired.
  ///
  /// In en, this message translates to:
  /// **'This code has expired. Send a new one.'**
  String get codeExpired;

  /// No description provided for @accountBlocked.
  ///
  /// In en, this message translates to:
  /// **'This account has been blocked. Contact support if you think this is a mistake.'**
  String get accountBlocked;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Tell us about you'**
  String get profileTitle;

  /// No description provided for @yourName.
  ///
  /// In en, this message translates to:
  /// **'Your name'**
  String get yourName;

  /// No description provided for @nameHelp.
  ///
  /// In en, this message translates to:
  /// **'Shown on your items as first name only'**
  String get nameHelp;

  /// No description provided for @nameInvalid.
  ///
  /// In en, this message translates to:
  /// **'Use letters, spaces and dots only (2–40)'**
  String get nameInvalid;

  /// No description provided for @yourCity.
  ///
  /// In en, this message translates to:
  /// **'Your city'**
  String get yourCity;

  /// No description provided for @chooseCity.
  ///
  /// In en, this message translates to:
  /// **'Choose city'**
  String get chooseCity;

  /// No description provided for @continueLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueLabel;

  /// No description provided for @searchCity.
  ///
  /// In en, this message translates to:
  /// **'Search city'**
  String get searchCity;

  /// No description provided for @comingSoon.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get comingSoon;

  /// No description provided for @comingSoonTitle.
  ///
  /// In en, this message translates to:
  /// **'RentNook is not in {city} yet'**
  String comingSoonTitle(Object city);

  /// No description provided for @comingSoonBody.
  ///
  /// In en, this message translates to:
  /// **'We are opening city by city. Tap below and we will tell you the day it opens.'**
  String get comingSoonBody;

  /// No description provided for @notifyMe.
  ///
  /// In en, this message translates to:
  /// **'Notify me when it opens'**
  String get notifyMe;

  /// No description provided for @waitlistDone.
  ///
  /// In en, this message translates to:
  /// **'Done. We will let you know.'**
  String get waitlistDone;

  /// No description provided for @chooseAnotherCity.
  ///
  /// In en, this message translates to:
  /// **'Choose another city'**
  String get chooseAnotherCity;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get navSearch;

  /// No description provided for @navMyItems.
  ///
  /// In en, this message translates to:
  /// **'My items'**
  String get navMyItems;

  /// No description provided for @navSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get navSaved;

  /// No description provided for @navProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get navProfile;

  /// No description provided for @signInToContinue.
  ///
  /// In en, this message translates to:
  /// **'Sign in to continue'**
  String get signInToContinue;

  /// No description provided for @signInSheetBody.
  ///
  /// In en, this message translates to:
  /// **'You need an account to save items, contact owners or put things on rent.'**
  String get signInSheetBody;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @notNow.
  ///
  /// In en, this message translates to:
  /// **'Not now'**
  String get notNow;

  /// No description provided for @sessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session ended. Please sign in again.'**
  String get sessionExpired;

  /// No description provided for @serverDown.
  ///
  /// In en, this message translates to:
  /// **'Our server is not responding. Please try in a minute.'**
  String get serverDown;

  /// No description provided for @searchHint.
  ///
  /// In en, this message translates to:
  /// **'Search cameras, drills, sofas…'**
  String get searchHint;

  /// No description provided for @categories.
  ///
  /// In en, this message translates to:
  /// **'Categories'**
  String get categories;

  /// No description provided for @requestBannerTitle.
  ///
  /// In en, this message translates to:
  /// **'Can\'t find it?'**
  String get requestBannerTitle;

  /// No description provided for @requestBannerBody.
  ///
  /// In en, this message translates to:
  /// **'Post a request and owners nearby will reply'**
  String get requestBannerBody;

  /// No description provided for @sponsored.
  ///
  /// In en, this message translates to:
  /// **'Sponsored'**
  String get sponsored;

  /// No description provided for @latestIn.
  ///
  /// In en, this message translates to:
  /// **'Latest in {city}'**
  String latestIn(Object city);

  /// No description provided for @emptyCity.
  ///
  /// In en, this message translates to:
  /// **'No items yet in this city — be the first to list'**
  String get emptyCity;

  /// No description provided for @putOnRent.
  ///
  /// In en, this message translates to:
  /// **'Put an item on rent'**
  String get putOnRent;

  /// No description provided for @perDay.
  ///
  /// In en, this message translates to:
  /// **'/day'**
  String get perDay;

  /// No description provided for @perWeek.
  ///
  /// In en, this message translates to:
  /// **'/week'**
  String get perWeek;

  /// No description provided for @perMonth.
  ///
  /// In en, this message translates to:
  /// **'/month'**
  String get perMonth;

  /// No description provided for @kmAway.
  ///
  /// In en, this message translates to:
  /// **'{km} km'**
  String kmAway(Object km);

  /// No description provided for @verified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get verified;

  /// No description provided for @filters.
  ///
  /// In en, this message translates to:
  /// **'Filters'**
  String get filters;

  /// No description provided for @sortNearest.
  ///
  /// In en, this message translates to:
  /// **'Nearest'**
  String get sortNearest;

  /// No description provided for @sortNewest.
  ///
  /// In en, this message translates to:
  /// **'Newest'**
  String get sortNewest;

  /// No description provided for @sortPrice.
  ///
  /// In en, this message translates to:
  /// **'Lowest price'**
  String get sortPrice;

  /// No description provided for @resultsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No results} =1{1 result} other{{count} results}}'**
  String resultsCount(num count);

  /// No description provided for @noResultsTitle.
  ///
  /// In en, this message translates to:
  /// **'Nothing found for this'**
  String get noResultsTitle;

  /// No description provided for @noResultsBody.
  ///
  /// In en, this message translates to:
  /// **'Try another word, or ask owners nearby.'**
  String get noResultsBody;

  /// No description provided for @requestThisItem.
  ///
  /// In en, this message translates to:
  /// **'Request this item'**
  String get requestThisItem;

  /// No description provided for @area.
  ///
  /// In en, this message translates to:
  /// **'Area'**
  String get area;

  /// No description provided for @anyArea.
  ///
  /// In en, this message translates to:
  /// **'Any area'**
  String get anyArea;

  /// No description provided for @priceRange.
  ///
  /// In en, this message translates to:
  /// **'Price range (₹)'**
  String get priceRange;

  /// No description provided for @min.
  ///
  /// In en, this message translates to:
  /// **'Min'**
  String get min;

  /// No description provided for @max.
  ///
  /// In en, this message translates to:
  /// **'Max'**
  String get max;

  /// No description provided for @rentPeriod.
  ///
  /// In en, this message translates to:
  /// **'Rent per'**
  String get rentPeriod;

  /// No description provided for @any.
  ///
  /// In en, this message translates to:
  /// **'Any'**
  String get any;

  /// No description provided for @day.
  ///
  /// In en, this message translates to:
  /// **'Day'**
  String get day;

  /// No description provided for @week.
  ///
  /// In en, this message translates to:
  /// **'Week'**
  String get week;

  /// No description provided for @month.
  ///
  /// In en, this message translates to:
  /// **'Month'**
  String get month;

  /// No description provided for @verifiedOnly.
  ///
  /// In en, this message translates to:
  /// **'Verified owners only'**
  String get verifiedOnly;

  /// No description provided for @apply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get apply;

  /// No description provided for @clear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get clear;

  /// No description provided for @deposit.
  ///
  /// In en, this message translates to:
  /// **'Deposit'**
  String get deposit;

  /// No description provided for @condition.
  ///
  /// In en, this message translates to:
  /// **'Condition'**
  String get condition;

  /// No description provided for @condNEW.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get condNEW;

  /// No description provided for @condLIKE_NEW.
  ///
  /// In en, this message translates to:
  /// **'Like new'**
  String get condLIKE_NEW;

  /// No description provided for @condGOOD.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get condGOOD;

  /// No description provided for @condFAIR.
  ///
  /// In en, this message translates to:
  /// **'Fair'**
  String get condFAIR;

  /// No description provided for @memberSince.
  ///
  /// In en, this message translates to:
  /// **'Member since {date}'**
  String memberSince(Object date);

  /// No description provided for @chatOnWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'Chat on WhatsApp'**
  String get chatOnWhatsapp;

  /// No description provided for @noLongerAvailable.
  ///
  /// In en, this message translates to:
  /// **'This item is no longer available'**
  String get noLongerAvailable;

  /// No description provided for @rentedOutNow.
  ///
  /// In en, this message translates to:
  /// **'Rented out right now'**
  String get rentedOutNow;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @saved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get saved;

  /// No description provided for @share.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get share;

  /// No description provided for @report.
  ///
  /// In en, this message translates to:
  /// **'Report'**
  String get report;

  /// No description provided for @safetyTitle.
  ///
  /// In en, this message translates to:
  /// **'Before you meet'**
  String get safetyTitle;

  /// No description provided for @openWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'Open WhatsApp'**
  String get openWhatsapp;

  /// No description provided for @whatsappMissing.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp is not installed on this phone.'**
  String get whatsappMissing;

  /// No description provided for @installWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'Get WhatsApp'**
  String get installWhatsapp;

  /// No description provided for @contactLimit.
  ///
  /// In en, this message translates to:
  /// **'You have contacted many owners today. Try again tomorrow.'**
  String get contactLimit;

  /// No description provided for @savedEmpty.
  ///
  /// In en, this message translates to:
  /// **'Tap the heart on any item to save it'**
  String get savedEmpty;

  /// No description provided for @remove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get remove;

  /// No description provided for @notAvailableShort.
  ///
  /// In en, this message translates to:
  /// **'Not available'**
  String get notAvailableShort;

  /// No description provided for @reportTitle.
  ///
  /// In en, this message translates to:
  /// **'What is wrong?'**
  String get reportTitle;

  /// No description provided for @reasonFAKE_ITEM.
  ///
  /// In en, this message translates to:
  /// **'Fake item or photos'**
  String get reasonFAKE_ITEM;

  /// No description provided for @reasonADVANCE_PAYMENT.
  ///
  /// In en, this message translates to:
  /// **'Asks for advance payment'**
  String get reasonADVANCE_PAYMENT;

  /// No description provided for @reasonWRONG_PRICE.
  ///
  /// In en, this message translates to:
  /// **'Wrong price'**
  String get reasonWRONG_PRICE;

  /// No description provided for @reasonOFFENSIVE.
  ///
  /// In en, this message translates to:
  /// **'Offensive'**
  String get reasonOFFENSIVE;

  /// No description provided for @reasonOTHER.
  ///
  /// In en, this message translates to:
  /// **'Something else'**
  String get reasonOTHER;

  /// No description provided for @addNote.
  ///
  /// In en, this message translates to:
  /// **'Add a note (optional)'**
  String get addNote;

  /// No description provided for @reportSent.
  ///
  /// In en, this message translates to:
  /// **'Thanks for telling us. We will check it.'**
  String get reportSent;

  /// No description provided for @alreadyReported.
  ///
  /// In en, this message translates to:
  /// **'You have already reported this'**
  String get alreadyReported;

  /// No description provided for @blockOwner.
  ///
  /// In en, this message translates to:
  /// **'Block this person'**
  String get blockOwner;

  /// No description provided for @blocked.
  ///
  /// In en, this message translates to:
  /// **'Blocked. You will not see each other’s items.'**
  String get blocked;

  /// No description provided for @addItemTitle.
  ///
  /// In en, this message translates to:
  /// **'Put an item on rent'**
  String get addItemTitle;

  /// No description provided for @editItemTitle.
  ///
  /// In en, this message translates to:
  /// **'Edit item'**
  String get editItemTitle;

  /// No description provided for @photos.
  ///
  /// In en, this message translates to:
  /// **'Photos'**
  String get photos;

  /// No description provided for @photosHelp.
  ///
  /// In en, this message translates to:
  /// **'1 to 8 real photos. The first one is the cover.'**
  String get photosHelp;

  /// No description provided for @addPhoto.
  ///
  /// In en, this message translates to:
  /// **'Add photo'**
  String get addPhoto;

  /// No description provided for @camera.
  ///
  /// In en, this message translates to:
  /// **'Camera'**
  String get camera;

  /// No description provided for @gallery.
  ///
  /// In en, this message translates to:
  /// **'Gallery'**
  String get gallery;

  /// No description provided for @uploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Upload failed'**
  String get uploadFailed;

  /// No description provided for @title.
  ///
  /// In en, this message translates to:
  /// **'Title'**
  String get title;

  /// No description provided for @titleHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. Canon 1500D with 18-55mm lens'**
  String get titleHint;

  /// No description provided for @category.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get category;

  /// No description provided for @rentPerDay.
  ///
  /// In en, this message translates to:
  /// **'Rent per day (₹)'**
  String get rentPerDay;

  /// No description provided for @rentPerWeek.
  ///
  /// In en, this message translates to:
  /// **'Rent per week (₹)'**
  String get rentPerWeek;

  /// No description provided for @rentPerMonth.
  ///
  /// In en, this message translates to:
  /// **'Rent per month (₹)'**
  String get rentPerMonth;

  /// No description provided for @atLeastOneRent.
  ///
  /// In en, this message translates to:
  /// **'Add rent per day, week or month'**
  String get atLeastOneRent;

  /// No description provided for @depositOptional.
  ///
  /// In en, this message translates to:
  /// **'Deposit (₹, optional)'**
  String get depositOptional;

  /// No description provided for @whatsappNumber.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp number'**
  String get whatsappNumber;

  /// No description provided for @whatsappHelp.
  ///
  /// In en, this message translates to:
  /// **'Empty = your login number. Only shared when someone taps Chat.'**
  String get whatsappHelp;

  /// No description provided for @description.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get description;

  /// No description provided for @descriptionHint.
  ///
  /// In en, this message translates to:
  /// **'What is included, its condition, pickup details'**
  String get descriptionHint;

  /// No description provided for @saveDraft.
  ///
  /// In en, this message translates to:
  /// **'Save draft'**
  String get saveDraft;

  /// No description provided for @submit.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get submit;

  /// No description provided for @titleLength.
  ///
  /// In en, this message translates to:
  /// **'Title must be 8–80 characters'**
  String get titleLength;

  /// No description provided for @descLength.
  ///
  /// In en, this message translates to:
  /// **'Description must be 20–1,000 characters'**
  String get descLength;

  /// No description provided for @priceRangeError.
  ///
  /// In en, this message translates to:
  /// **'Use whole rupees from 1 to 10,00,000'**
  String get priceRangeError;

  /// No description provided for @needPhoto.
  ///
  /// In en, this message translates to:
  /// **'Add at least one photo'**
  String get needPhoto;

  /// No description provided for @contactRemoved.
  ///
  /// In en, this message translates to:
  /// **'We removed phone numbers or links from the text. People contact you through the WhatsApp button.'**
  String get contactRemoved;

  /// No description provided for @discardTitle.
  ///
  /// In en, this message translates to:
  /// **'Leave without saving?'**
  String get discardTitle;

  /// No description provided for @discardBody.
  ///
  /// In en, this message translates to:
  /// **'Your changes will be lost.'**
  String get discardBody;

  /// No description provided for @leave.
  ///
  /// In en, this message translates to:
  /// **'Leave'**
  String get leave;

  /// No description provided for @stay.
  ///
  /// In en, this message translates to:
  /// **'Stay'**
  String get stay;

  /// No description provided for @itemLive.
  ///
  /// In en, this message translates to:
  /// **'Your item is live'**
  String get itemLive;

  /// No description provided for @statusDRAFT.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get statusDRAFT;

  /// No description provided for @statusREVIEW.
  ///
  /// In en, this message translates to:
  /// **'Under review'**
  String get statusREVIEW;

  /// No description provided for @statusLIVE.
  ///
  /// In en, this message translates to:
  /// **'Live'**
  String get statusLIVE;

  /// No description provided for @statusRENTED_OUT.
  ///
  /// In en, this message translates to:
  /// **'Rented out'**
  String get statusRENTED_OUT;

  /// No description provided for @statusHIDDEN.
  ///
  /// In en, this message translates to:
  /// **'Hidden'**
  String get statusHIDDEN;

  /// No description provided for @statusPENDING.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get statusPENDING;

  /// No description provided for @statusAPPROVED.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get statusAPPROVED;

  /// No description provided for @statusREJECTED.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get statusREJECTED;

  /// No description provided for @edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// No description provided for @markRented.
  ///
  /// In en, this message translates to:
  /// **'Mark rented'**
  String get markRented;

  /// No description provided for @markAvailable.
  ///
  /// In en, this message translates to:
  /// **'Mark available'**
  String get markAvailable;

  /// No description provided for @pause.
  ///
  /// In en, this message translates to:
  /// **'Pause'**
  String get pause;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @boost.
  ///
  /// In en, this message translates to:
  /// **'Boost'**
  String get boost;

  /// No description provided for @goLive.
  ///
  /// In en, this message translates to:
  /// **'Go live'**
  String get goLive;

  /// No description provided for @deleteItemTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete this item?'**
  String get deleteItemTitle;

  /// No description provided for @deleteItemBody.
  ///
  /// In en, this message translates to:
  /// **'It will be removed from RentNook.'**
  String get deleteItemBody;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @myItemsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Put your first item on rent'**
  String get myItemsEmpty;

  /// No description provided for @noPlanTitle.
  ///
  /// In en, this message translates to:
  /// **'No active plan'**
  String get noPlanTitle;

  /// No description provided for @noPlanBody.
  ///
  /// In en, this message translates to:
  /// **'Choose a plan so people can see your items.'**
  String get noPlanBody;

  /// No description provided for @choosePlan.
  ///
  /// In en, this message translates to:
  /// **'Choose a plan'**
  String get choosePlan;

  /// No description provided for @daysLeft.
  ///
  /// In en, this message translates to:
  /// **'{days, plural, =1{1 day left} other{{days} days left}}'**
  String daysLeft(num days);

  /// No description provided for @renew.
  ///
  /// In en, this message translates to:
  /// **'Renew'**
  String get renew;

  /// No description provided for @upgrade.
  ///
  /// In en, this message translates to:
  /// **'Upgrade'**
  String get upgrade;

  /// No description provided for @views.
  ///
  /// In en, this message translates to:
  /// **'Views'**
  String get views;

  /// No description provided for @whatsappChats.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp chats'**
  String get whatsappChats;

  /// No description provided for @itemsLive.
  ///
  /// In en, this message translates to:
  /// **'Items live'**
  String get itemsLive;

  /// No description provided for @overLimit.
  ///
  /// In en, this message translates to:
  /// **'Some items are in Draft because your plan limit is full.'**
  String get overLimit;

  /// No description provided for @plansTitle.
  ///
  /// In en, this message translates to:
  /// **'Plans'**
  String get plansTitle;

  /// No description provided for @plansSoon.
  ///
  /// In en, this message translates to:
  /// **'Plans will be available soon'**
  String get plansSoon;

  /// No description provided for @freePlans.
  ///
  /// In en, this message translates to:
  /// **'Free offers'**
  String get freePlans;

  /// No description provided for @paidPlans.
  ///
  /// In en, this message translates to:
  /// **'Plans'**
  String get paidPlans;

  /// No description provided for @days.
  ///
  /// In en, this message translates to:
  /// **'{days} days'**
  String days(Object days);

  /// No description provided for @itemsLimit.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 item} other{{count} items}}'**
  String itemsLimit(num count);

  /// No description provided for @unlimitedItems.
  ///
  /// In en, this message translates to:
  /// **'Unlimited items'**
  String get unlimitedItems;

  /// No description provided for @activate.
  ///
  /// In en, this message translates to:
  /// **'Activate'**
  String get activate;

  /// No description provided for @activateFree.
  ///
  /// In en, this message translates to:
  /// **'Activate free plan'**
  String get activateFree;

  /// No description provided for @payViaUpi.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount} via UPI'**
  String payViaUpi(Object amount);

  /// No description provided for @alreadyUsed.
  ///
  /// In en, this message translates to:
  /// **'You have already used this offer'**
  String get alreadyUsed;

  /// No description provided for @couponHint.
  ///
  /// In en, this message translates to:
  /// **'Have a coupon?'**
  String get couponHint;

  /// No description provided for @applyCoupon.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get applyCoupon;

  /// No description provided for @couponSaved.
  ///
  /// In en, this message translates to:
  /// **'You save {amount}'**
  String couponSaved(Object amount);

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @waitingApproval.
  ///
  /// In en, this message translates to:
  /// **'Request sent. We will activate it after a quick check.'**
  String get waitingApproval;

  /// No description provided for @planActive.
  ///
  /// In en, this message translates to:
  /// **'Plan active till {date}'**
  String planActive(Object date);

  /// No description provided for @payTitle.
  ///
  /// In en, this message translates to:
  /// **'Pay with UPI'**
  String get payTitle;

  /// No description provided for @payTo.
  ///
  /// In en, this message translates to:
  /// **'Paying'**
  String get payTo;

  /// No description provided for @upiId.
  ///
  /// In en, this message translates to:
  /// **'UPI ID'**
  String get upiId;

  /// No description provided for @amount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get amount;

  /// No description provided for @paymentFor.
  ///
  /// In en, this message translates to:
  /// **'For'**
  String get paymentFor;

  /// No description provided for @reference.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get reference;

  /// No description provided for @openUpiApp.
  ///
  /// In en, this message translates to:
  /// **'Pay with a UPI app'**
  String get openUpiApp;

  /// No description provided for @scanQr.
  ///
  /// In en, this message translates to:
  /// **'Or scan this QR from another phone'**
  String get scanQr;

  /// No description provided for @afterPaying.
  ///
  /// In en, this message translates to:
  /// **'After paying, come back and enter the UTR.'**
  String get afterPaying;

  /// No description provided for @iHavePaid.
  ///
  /// In en, this message translates to:
  /// **'I have paid, enter UTR'**
  String get iHavePaid;

  /// No description provided for @noUpiApp.
  ///
  /// In en, this message translates to:
  /// **'No UPI app found. Scan the QR or pay to the UPI ID above.'**
  String get noUpiApp;

  /// No description provided for @utrTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter UTR'**
  String get utrTitle;

  /// No description provided for @utrLabel.
  ///
  /// In en, this message translates to:
  /// **'12-digit UTR / reference number'**
  String get utrLabel;

  /// No description provided for @utrHelp.
  ///
  /// In en, this message translates to:
  /// **'Open your UPI app → payment history → this payment. It is called UTR, UPI Ref No. or Transaction ID.'**
  String get utrHelp;

  /// No description provided for @utrInvalid.
  ///
  /// In en, this message translates to:
  /// **'UTR must be exactly 12 digits'**
  String get utrInvalid;

  /// No description provided for @attachScreenshot.
  ///
  /// In en, this message translates to:
  /// **'Attach screenshot (optional)'**
  String get attachScreenshot;

  /// No description provided for @screenshotAttached.
  ///
  /// In en, this message translates to:
  /// **'Screenshot attached'**
  String get screenshotAttached;

  /// No description provided for @utrUsed.
  ///
  /// In en, this message translates to:
  /// **'This UTR has already been used'**
  String get utrUsed;

  /// No description provided for @paymentStatusTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment status'**
  String get paymentStatusTitle;

  /// No description provided for @stepSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Submitted'**
  String get stepSubmitted;

  /// No description provided for @stepChecking.
  ///
  /// In en, this message translates to:
  /// **'Checking with bank statement'**
  String get stepChecking;

  /// No description provided for @stepApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get stepApproved;

  /// No description provided for @stepRejected.
  ///
  /// In en, this message translates to:
  /// **'Not confirmed'**
  String get stepRejected;

  /// No description provided for @checkingNote.
  ///
  /// In en, this message translates to:
  /// **'We check every payment by hand, usually within 4 working hours.'**
  String get checkingNote;

  /// No description provided for @submitAgain.
  ///
  /// In en, this message translates to:
  /// **'Submit again'**
  String get submitAgain;

  /// No description provided for @myPayments.
  ///
  /// In en, this message translates to:
  /// **'My payments'**
  String get myPayments;

  /// No description provided for @boostTitle.
  ///
  /// In en, this message translates to:
  /// **'Boost this item'**
  String get boostTitle;

  /// No description provided for @boostBody.
  ///
  /// In en, this message translates to:
  /// **'Boosted items show in the Sponsored row on Home for the days you choose.'**
  String get boostBody;

  /// No description provided for @boostDays.
  ///
  /// In en, this message translates to:
  /// **'{days} days'**
  String boostDays(Object days);

  /// No description provided for @useCredit.
  ///
  /// In en, this message translates to:
  /// **'Use boost credit ({count} left)'**
  String useCredit(Object count);

  /// No description provided for @boostQueued.
  ///
  /// In en, this message translates to:
  /// **'Boost booked. It starts as soon as a sponsored slot frees up.'**
  String get boostQueued;

  /// No description provided for @boostStarted.
  ///
  /// In en, this message translates to:
  /// **'Boost started'**
  String get boostStarted;

  /// No description provided for @boostedTill.
  ///
  /// In en, this message translates to:
  /// **'Boosted till {date}'**
  String boostedTill(Object date);

  /// No description provided for @notificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notificationsTitle;

  /// No description provided for @notificationsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing here yet. Payment updates and requests show up here.'**
  String get notificationsEmpty;

  /// No description provided for @markAllRead.
  ///
  /// In en, this message translates to:
  /// **'Mark all read'**
  String get markAllRead;

  /// No description provided for @pushAskTitle.
  ///
  /// In en, this message translates to:
  /// **'Get updates?'**
  String get pushAskTitle;

  /// No description provided for @pushAskBody.
  ///
  /// In en, this message translates to:
  /// **'We will tell you when a payment is approved or someone needs your item. No spam.'**
  String get pushAskBody;

  /// No description provided for @allow.
  ///
  /// In en, this message translates to:
  /// **'Allow'**
  String get allow;

  /// No description provided for @editProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get editProfile;

  /// No description provided for @startRenting.
  ///
  /// In en, this message translates to:
  /// **'Start renting out'**
  String get startRenting;

  /// No description provided for @myPlan.
  ///
  /// In en, this message translates to:
  /// **'My plan'**
  String get myPlan;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @helpSafety.
  ///
  /// In en, this message translates to:
  /// **'Help and safety'**
  String get helpSafety;

  /// No description provided for @termsPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Terms and Privacy'**
  String get termsPrivacy;

  /// No description provided for @deleteMyAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete my account'**
  String get deleteMyAccount;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logout;

  /// No description provided for @referFriend.
  ///
  /// In en, this message translates to:
  /// **'Refer a friend'**
  String get referFriend;

  /// No description provided for @requests.
  ///
  /// In en, this message translates to:
  /// **'My requests'**
  String get requests;

  /// No description provided for @getVerified.
  ///
  /// In en, this message translates to:
  /// **'Get ID verified'**
  String get getVerified;

  /// No description provided for @myShop.
  ///
  /// In en, this message translates to:
  /// **'My shop page'**
  String get myShop;

  /// No description provided for @guestProfile.
  ///
  /// In en, this message translates to:
  /// **'You are browsing as a guest'**
  String get guestProfile;

  /// No description provided for @deleteTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete your account'**
  String get deleteTitle;

  /// No description provided for @deleteWhat.
  ///
  /// In en, this message translates to:
  /// **'Deleted: your profile, all your items and photos, saved items, requests, notifications, shop page and ID photo.'**
  String get deleteWhat;

  /// No description provided for @deleteKept.
  ///
  /// In en, this message translates to:
  /// **'Kept: payment records needed for tax, without your name or number.'**
  String get deleteKept;

  /// No description provided for @deleteTiming.
  ///
  /// In en, this message translates to:
  /// **'Your items are hidden right away. Everything else is removed within 7 days.'**
  String get deleteTiming;

  /// No description provided for @deletePlanWarning.
  ///
  /// In en, this message translates to:
  /// **'Your running plan ends and is not refunded.'**
  String get deletePlanWarning;

  /// No description provided for @reasonOptional.
  ///
  /// In en, this message translates to:
  /// **'Reason (optional)'**
  String get reasonOptional;

  /// No description provided for @confirmWithOtp.
  ///
  /// In en, this message translates to:
  /// **'Confirm with OTP'**
  String get confirmWithOtp;

  /// No description provided for @deleteFinal.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get deleteFinal;

  /// No description provided for @deleteStarted.
  ///
  /// In en, this message translates to:
  /// **'Deletion started. You have been logged out.'**
  String get deleteStarted;

  /// No description provided for @howItWorks.
  ///
  /// In en, this message translates to:
  /// **'How renting works'**
  String get howItWorks;

  /// No description provided for @howItWorksBody.
  ///
  /// In en, this message translates to:
  /// **'Find an item, chat with the owner on WhatsApp, and agree dates, rent and deposit between you. RentNook does not take any commission and does not hold money.'**
  String get howItWorksBody;

  /// No description provided for @safetyTips.
  ///
  /// In en, this message translates to:
  /// **'Safety tips'**
  String get safetyTips;

  /// No description provided for @faqs.
  ///
  /// In en, this message translates to:
  /// **'Questions'**
  String get faqs;

  /// No description provided for @contactSupport.
  ///
  /// In en, this message translates to:
  /// **'Contact support'**
  String get contactSupport;

  /// No description provided for @grievanceOfficer.
  ///
  /// In en, this message translates to:
  /// **'Grievance officer'**
  String get grievanceOfficer;

  /// No description provided for @referTitle.
  ///
  /// In en, this message translates to:
  /// **'Refer a friend'**
  String get referTitle;

  /// No description provided for @referBody.
  ///
  /// In en, this message translates to:
  /// **'When a friend you invite buys their first plan, you get {days} free days.'**
  String referBody(Object days);

  /// No description provided for @yourCode.
  ///
  /// In en, this message translates to:
  /// **'Your code'**
  String get yourCode;

  /// No description provided for @shareCode.
  ///
  /// In en, this message translates to:
  /// **'Share invite'**
  String get shareCode;

  /// No description provided for @rewardsEarned.
  ///
  /// In en, this message translates to:
  /// **'{count} rewards · {days} days earned'**
  String rewardsEarned(Object count, Object days);

  /// No description provided for @haveCode.
  ///
  /// In en, this message translates to:
  /// **'Got a code from a friend?'**
  String get haveCode;

  /// No description provided for @codeApplied.
  ///
  /// In en, this message translates to:
  /// **'Code applied'**
  String get codeApplied;

  /// No description provided for @shareCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Share this item'**
  String get shareCardTitle;

  /// No description provided for @whatsappStatus.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp Status'**
  String get whatsappStatus;

  /// No description provided for @copyLink.
  ///
  /// In en, this message translates to:
  /// **'Copy link'**
  String get copyLink;

  /// No description provided for @more.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get more;

  /// No description provided for @linkCopied.
  ///
  /// In en, this message translates to:
  /// **'Link copied'**
  String get linkCopied;

  /// No description provided for @requestTitle.
  ///
  /// In en, this message translates to:
  /// **'Request an item'**
  String get requestTitle;

  /// No description provided for @requestWhat.
  ///
  /// In en, this message translates to:
  /// **'What do you need?'**
  String get requestWhat;

  /// No description provided for @requestWhatHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. DSLR for a wedding on Sunday'**
  String get requestWhatHint;

  /// No description provided for @fromDate.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get fromDate;

  /// No description provided for @toDate.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get toDate;

  /// No description provided for @post.
  ///
  /// In en, this message translates to:
  /// **'Post'**
  String get post;

  /// No description provided for @requestPosted.
  ///
  /// In en, this message translates to:
  /// **'Posted. {count} owners nearby were told.'**
  String requestPosted(Object count);

  /// No description provided for @requestLimit.
  ///
  /// In en, this message translates to:
  /// **'You can post 5 requests a day.'**
  String get requestLimit;

  /// No description provided for @requestsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No requests yet'**
  String get requestsEmpty;

  /// No description provided for @replyOnWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'Reply on WhatsApp'**
  String get replyOnWhatsapp;

  /// No description provided for @nearMeAskTitle.
  ///
  /// In en, this message translates to:
  /// **'Sort by distance?'**
  String get nearMeAskTitle;

  /// No description provided for @nearMeAskBody.
  ///
  /// In en, this message translates to:
  /// **'We use your approximate location (about 500 m) once to sort items. It is not saved.'**
  String get nearMeAskBody;

  /// No description provided for @useMyLocation.
  ///
  /// In en, this message translates to:
  /// **'Use my location'**
  String get useMyLocation;

  /// No description provided for @locationDenied.
  ///
  /// In en, this message translates to:
  /// **'Location is off, so we sorted by your city.'**
  String get locationDenied;

  /// No description provided for @idTitle.
  ///
  /// In en, this message translates to:
  /// **'Get the verified mark'**
  String get idTitle;

  /// No description provided for @idBody.
  ///
  /// In en, this message translates to:
  /// **'Upload a clear photo of the front of a government ID. Only our senior team sees it, and it is deleted 30 days after the check. We never ask you to type the ID number.'**
  String get idBody;

  /// No description provided for @uploadId.
  ///
  /// In en, this message translates to:
  /// **'Upload ID photo'**
  String get uploadId;

  /// No description provided for @idPending.
  ///
  /// In en, this message translates to:
  /// **'We are checking your ID.'**
  String get idPending;

  /// No description provided for @idVerified.
  ///
  /// In en, this message translates to:
  /// **'You are verified.'**
  String get idVerified;

  /// No description provided for @idRejected.
  ///
  /// In en, this message translates to:
  /// **'Not verified: {reason}'**
  String idRejected(Object reason);

  /// No description provided for @shopTitle.
  ///
  /// In en, this message translates to:
  /// **'Shop page'**
  String get shopTitle;

  /// No description provided for @shopNeedsBusiness.
  ///
  /// In en, this message translates to:
  /// **'Shop pages come with the Business plan.'**
  String get shopNeedsBusiness;

  /// No description provided for @shopName.
  ///
  /// In en, this message translates to:
  /// **'Shop name'**
  String get shopName;

  /// No description provided for @timings.
  ///
  /// In en, this message translates to:
  /// **'Timings'**
  String get timings;

  /// No description provided for @about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// No description provided for @logo.
  ///
  /// In en, this message translates to:
  /// **'Logo'**
  String get logo;

  /// No description provided for @shopSaved.
  ///
  /// In en, this message translates to:
  /// **'Shop page saved'**
  String get shopSaved;

  /// No description provided for @english.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get english;

  /// No description provided for @hindi.
  ///
  /// In en, this message translates to:
  /// **'हिंदी'**
  String get hindi;

  /// No description provided for @somethingWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get somethingWrong;

  /// No description provided for @galleryTitle.
  ///
  /// In en, this message translates to:
  /// **'Component gallery'**
  String get galleryTitle;
}

class _LDelegate extends LocalizationsDelegate<L> {
  const _LDelegate();

  @override
  Future<L> load(Locale locale) {
    return SynchronousFuture<L>(lookupL(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi'].contains(locale.languageCode);

  @override
  bool shouldReload(_LDelegate old) => false;
}

L lookupL(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return LEn();
    case 'hi':
      return LHi();
  }

  throw FlutterError(
    'L.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
