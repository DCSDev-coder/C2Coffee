import 'package:intl_phone_field/countries.dart' as intl_countries;

final List<intl_countries.Country> authCountries = [
  ...intl_countries.countries.where((c) => c.code == 'MY').map(
        (c) => intl_countries.Country(
          name: ' Malaysia',
          nameTranslations: const {},
          flag: c.flag,
          code: c.code,
          dialCode: c.dialCode,
          minLength: c.minLength,
          maxLength: c.maxLength,
          regionCode: c.regionCode,
        ),
      ),
  ...intl_countries.countries.where((c) => c.code == 'SG').map(
        (c) => intl_countries.Country(
          name: ' Singapore',
          nameTranslations: const {},
          flag: c.flag,
          code: c.code,
          dialCode: c.dialCode,
          minLength: c.minLength,
          maxLength: c.maxLength,
          regionCode: c.regionCode,
        ),
      ),
  ...intl_countries.countries.where((c) => c.code != 'MY' && c.code != 'SG'),
];
