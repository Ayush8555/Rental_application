// Plain data classes for what the API returns. The API never sends phone
// numbers or exact locations except where a screen needs them (masked number
// on Profile, wa.me link after tapping Chat).

typedef Json = Map<String, dynamic>;

int? _int(Object? v) => v is num ? v.toInt() : null;
String _s(Object? v) => v is String ? v : '';

class City {
  City(this.id, this.name, this.nameHi, this.state, this.isOpen);
  factory City.fromJson(Json j) => City(_s(j['id']), _s(j['name']), j['nameHi'] as String?, _s(j['state']), j['isOpen'] == true);
  final String id, name, state;
  final String? nameHi;
  final bool isOpen;
  String label(bool hindi) => hindi && (nameHi?.isNotEmpty ?? false) ? nameHi! : name;
}

class Area {
  Area(this.id, this.name);
  factory Area.fromJson(Json j) => Area(_s(j['id']), _s(j['name']));
  final String id, name;
}

class ExtraField {
  ExtraField(this.key, this.label, this.labelHi, this.type, this.options, this.required);
  factory ExtraField.fromJson(Json j) => ExtraField(_s(j['key']), _s(j['label']), j['labelHi'] as String?, _s(j['type']),
      (j['options'] as List?)?.cast<String>() ?? const [], j['required'] == true);
  final String key, label, type;
  final String? labelHi;
  final List<String> options;
  final bool required;
}

class Category {
  Category(this.id, this.name, this.nameHi, this.icon, this.fields);
  factory Category.fromJson(Json j) => Category(_s(j['id']), _s(j['name']), _s(j['nameHi']), _s(j['icon']),
      ((j['fields'] as List?) ?? const []).map((e) => ExtraField.fromJson(e as Json)).toList());
  final String id, name, nameHi, icon;
  final List<ExtraField> fields;
  String label(bool hindi) => hindi && nameHi.isNotEmpty ? nameHi : name;
}

class ListingCard {
  ListingCard.fromJson(Json j)
      : id = _s(j['id']),
        shortId = _s(j['shortId']),
        title = _s(j['title']),
        categoryName = _s((j['category'] as Json?)?['name']),
        categoryNameHi = _s((j['category'] as Json?)?['nameHi']),
        categoryIcon = _s((j['category'] as Json?)?['icon']),
        areaName = _s((j['area'] as Json?)?['name']),
        rentDay = _int(j['rentDayPaise']),
        rentWeek = _int(j['rentWeekPaise']),
        rentMonth = _int(j['rentMonthPaise']),
        deposit = _int(j['depositPaise']),
        condition = _s(j['condition']),
        thumbnail = j['thumbnail'] as String?,
        distanceKm = (j['distanceKm'] as num?)?.toDouble(),
        verified = j['verified'] == true,
        sponsored = j['sponsored'] == true,
        saved = j['saved'] == true,
        available = j['available'] != false,
        raw = j;
  final String id, shortId, title, categoryName, categoryNameHi, categoryIcon, areaName, condition;
  final int? rentDay, rentWeek, rentMonth, deposit;
  final String? thumbnail;
  final double? distanceKm;
  final bool verified, sponsored, saved, available;
  final Json raw;
}

class ListingDetail extends ListingCard {
  ListingDetail.fromJson(super.j)
      : description = _s(j['description']),
        images = ((j['images'] as List?) ?? const []).map((e) => _s((e as Json)['url'])).toList(),
        ownerId = _s((j['owner'] as Json?)?['id']),
        ownerFirstName = _s((j['owner'] as Json?)?['firstName']),
        ownerSince = _s((j['owner'] as Json?)?['memberSince']),
        shopId = ((j['owner'] as Json?)?['shop'] as Json?)?['id'] as String?,
        shopName = ((j['owner'] as Json?)?['shop'] as Json?)?['name'] as String?,
        isOwner = j['isOwner'] == true,
        rentedOut = j['status'] == 'RENTED_OUT',
        extra = (j['extra'] as Json?) ?? const {},
        cityName = _s((j['city'] as Json?)?['name']),
        super.fromJson();
  final String description, ownerId, ownerFirstName, ownerSince, cityName;
  final List<String> images;
  final String? shopId, shopName;
  final bool isOwner, rentedOut;
  final Json extra;
}

class OwnListing extends ListingCard {
  OwnListing.fromJson(super.j)
      : status = _s(j['status']),
        hiddenReason = j['hiddenReason'] as String?,
        rejectReason = j['rejectReason'] as String?,
        description = _s(j['description']),
        categoryId = _s(j['categoryId']),
        areaId = _s(j['areaId']),
        viewCount = _int(j['viewCount']) ?? 0,
        waClickCount = _int(j['waClickCount']) ?? 0,
        featuredUntil = j['featuredUntil'] as String?,
        images = ((j['images'] as List?) ?? const []).map((e) => (id: _s((e as Json)['id']), url: _s(e['url']))).toList(),
        whatsappMasked = j['whatsappMasked'] as String?,
        extra = (j['extra'] as Json?) ?? const {},
        super.fromJson();
  final String status, description, categoryId, areaId;
  final String? hiddenReason, rejectReason, featuredUntil, whatsappMasked;
  final int viewCount, waClickCount;
  final List<({String id, String url})> images;
  final Json extra;
}

class Me {
  Me.fromJson(Json j)
      : id = _s(j['id']),
        name = j['name'] as String?,
        phoneMasked = _s(j['phoneMasked']),
        city = j['city'] == null ? null : City.fromJson(j['city'] as Json),
        language = _s(j['language']),
        isLister = j['isLister'] == true,
        idVerified = j['idVerified'] == true,
        referralCode = _s(j['referralCode']),
        memberSince = _s(j['memberSince']),
        consentRequired = j['consentRequired'] == true,
        planName = (j['plan'] as Json?)?['name'] as String?,
        planDaysLeft = _int((j['plan'] as Json?)?['daysLeft']);
  final String id, phoneMasked, language, referralCode, memberSince;
  final String? name, planName;
  final City? city;
  final bool isLister, idVerified, consentRequired;
  final int? planDaysLeft;
  bool get needsProfile => name == null || name!.isEmpty || city == null;
}

class Plan {
  Plan.fromJson(Json j)
      : id = _s(j['id']),
        name = _s(j['name']),
        type = _s(j['type']),
        pricePaise = _int(j['pricePaise']) ?? 0,
        durationDays = _int(j['durationDays']) ?? 0,
        listingLimit = _int(j['listingLimit']),
        boostCredits = _int(j['boostCredits']) ?? 0,
        needsApproval = j['needsApproval'] == true,
        badge = j['badge'] as String?,
        points = ((j['points'] as List?) ?? const []).cast<String>(),
        alreadyUsed = j['alreadyUsed'] == true;
  final String id, name, type;
  final int pricePaise, durationDays, boostCredits;
  final int? listingLimit;
  final bool needsApproval, alreadyUsed;
  final String? badge;
  final List<String> points;
  bool get isFree => pricePaise == 0;
}

class Upi {
  Upi.fromJson(Json j)
      : payeeName = _s(j['payeeName']),
        upiId = _s(j['upiId']),
        amountPaise = _int(j['amountPaise']) ?? 0,
        reference = _s(j['reference']),
        upiLink = _s(j['upiLink']),
        qrUrl = j['qrUrl'] as String?;
  final String payeeName, upiId, reference, upiLink;
  final int amountPaise;
  final String? qrUrl;
}

class Payment {
  Payment.fromJson(Json j)
      : id = _s(j['id']),
        reference = _s(j['reference']),
        purpose = _s(j['purpose']),
        status = _s(j['status']),
        amountPaise = _int(j['amountPaise']) ?? 0,
        discountPaise = _int(j['discountPaise']) ?? 0,
        rejectReason = j['rejectReason'] as String?,
        planName = j['planName'] as String?,
        submittedAt = j['submittedAt'] as String?,
        reviewedAt = j['reviewedAt'] as String?,
        createdAt = _s(j['createdAt']),
        upi = j['upi'] == null ? null : Upi.fromJson(j['upi'] as Json);
  final String id, reference, purpose, status, createdAt;
  final int amountPaise, discountPaise;
  final String? rejectReason, planName, submittedAt, reviewedAt;
  final Upi? upi;
}

class AppNotification {
  AppNotification.fromJson(Json j)
      : id = _s(j['id']),
        type = _s(j['type']),
        title = _s(j['title']),
        body = _s(j['body']),
        read = j['read'] == true,
        createdAt = _s(j['createdAt']),
        data = (j['data'] as Json?) ?? const {};
  final String id, type, title, body, createdAt;
  final bool read;
  final Json data;
}

class PublicSettings {
  PublicSettings.fromJson(Json j)
      : minAppVersion = _s(j['minAppVersion']),
        supportWhatsapp = (j['support'] as Json?)?['whatsapp'] as String?,
        supportEmail = (j['support'] as Json?)?['email'] as String?,
        supportHours = _s((j['support'] as Json?)?['hours']),
        grievanceName = _s((j['grievance'] as Json?)?['name']),
        grievanceEmail = _s((j['grievance'] as Json?)?['email']),
        privacyUrl = _s((j['legal'] as Json?)?['privacyUrl']),
        termsUrl = _s((j['legal'] as Json?)?['termsUrl']),
        privacyVersion = _s((j['legal'] as Json?)?['privacyVersion']),
        safetyTips = (((j['help'] as Json?)?['safetyTips'] as List?) ?? const []).cast<String>(),
        safetyTipsHi = (((j['help'] as Json?)?['safetyTipsHi'] as List?) ?? const []).cast<String>(),
        faqs = (((j['help'] as Json?)?['faqs'] as List?) ?? const []).map((e) => (q: _s((e as Json)['q']), a: _s(e['a']))).toList(),
        faqsHi = (((j['help'] as Json?)?['faqsHi'] as List?) ?? const []).map((e) => (q: _s((e as Json)['q']), a: _s(e['a']))).toList(),
        boostOptions = ((j['boostOptions'] as List?) ?? const []).map((e) => (days: _int((e as Json)['days']) ?? 0, pricePaise: _int(e['pricePaise']) ?? 0)).toList(),
        playStoreUrl = _s(j['playStoreUrl']),
        raw = j;
  final String minAppVersion, supportHours, grievanceName, grievanceEmail, privacyUrl, termsUrl, privacyVersion, playStoreUrl;
  final String? supportWhatsapp, supportEmail;
  final List<String> safetyTips, safetyTipsHi;
  final List<({String q, String a})> faqs, faqsHi;
  final List<({int days, int pricePaise})> boostOptions;
  final Json raw;
}

class Page<T> {
  Page(this.items, this.next, [this.total]);
  final List<T> items;
  final String? next;
  final int? total;
}
