export interface Currency {
  No: number;
  Kodu: string;
  Adı: string;
}

export const CURRENCIES: Currency[] = [
  { "No": 1, "Kodu": "USD", "Adı": "ABD Doları" },
  { "No": 20, "Kodu": "EUR", "Adı": "Euro" },
  { "No": 17, "Kodu": "GBP", "Adı": "İngiliz Sterlini" },
  { "No": 2, "Kodu": "DEM", "Adı": "Alman Markı" },
  { "No": 3, "Kodu": "AUD", "Adı": "Avustralya Doları" },
  { "No": 4, "Kodu": "ATS", "Adı": "Avusturya Şilini" },
  { "No": 5, "Kodu": "BEF", "Adı": "Belçika Frangı" },
  { "No": 6, "Kodu": "DKK", "Adı": "Danimarka Kronu" },
  { "No": 7, "Kodu": "FIM", "Adı": "Fin Markkası" },
  { "No": 8, "Kodu": "FRF", "Adı": "Fransız Frangı" },
  { "No": 9, "Kodu": "NLG", "Adı": "Hollanda Florini" },
  { "No": 10, "Kodu": "SEK", "Adı": "İsveç Kronu" },
  { "No": 11, "Kodu": "CHF", "Adı": "İsviçre Frangı" },
  { "No": 12, "Kodu": "ITL", "Adı": "İtalyan Lireti" },
  { "No": 13, "Kodu": "JPY", "Adı": "Japon Yeni" },
  { "No": 14, "Kodu": "CAD", "Adı": "Kanada Doları" },
  { "No": 15, "Kodu": "KWD", "Adı": "Kuveyt Dinarı" },
  { "No": 16, "Kodu": "NOK", "Adı": "Norveç Kronu" },
  { "No": 18, "Kodu": "SAR", "Adı": "S. Arabistan Riyali" },
  { "No": 19, "Kodu": "XEU", "Adı": "Avrupa Para Birimi" },
  { "No": 21, "Kodu": "AZM", "Adı": "Azerbaycan Manatı" },
  { "No": 22, "Kodu": "BRL", "Adı": "Brezilya Cruzeirosu" },
  { "No": 23, "Kodu": "BGN", "Adı": "Bulgar Levası" },
  { "No": 24, "Kodu": "CZK", "Adı": "Çek Kuronu" },
  { "No": 25, "Kodu": "CNY", "Adı": "Çin Yüeni" },
  { "No": 26, "Kodu": "EEK", "Adı": "Estonya Kuronu" },
  { "No": 27, "Kodu": "GEL", "Adı": "Gürcistan Larisi" },
  { "No": 28, "Kodu": "INR", "Adı": "Hindistan Rupisi" },
  { "No": 29, "Kodu": "HKD", "Adı": "Hongkong Doları" },
  { "No": 30, "Kodu": "IQD", "Adı": "Irak Dinarı" },
  { "No": 31, "Kodu": "IRR", "Adı": "İran Riyali" },
  { "No": 32, "Kodu": "IEP", "Adı": "İrlanda Lirası" },
  { "No": 33, "Kodu": "ESP", "Adı": "İspanyol Pesetası" },
  { "No": 34, "Kodu": "ILS", "Adı": "İsrail Şekeli" },
  { "No": 35, "Kodu": "ISK", "Adı": "İzlanda Kuronu" },
  { "No": 36, "Kodu": "CYP", "Adı": "Kıbrıs Lirası" },
  { "No": 37, "Kodu": "KGS", "Adı": "Kırgızistan Somu" },
  { "No": 38, "Kodu": "LVL", "Adı": "Letonya Latsı" },
  { "No": 39, "Kodu": "LYD", "Adı": "Libya Dinarı" },
  { "No": 40, "Kodu": "LBP", "Adı": "Lübnan Lirası" },
  { "No": 41, "Kodu": "LTL", "Adı": "Litvanya Litası" },
  { "No": 42, "Kodu": "LUF", "Adı": "Lüksemburg Frangı" },
  { "No": 43, "Kodu": "HUF", "Adı": "Macaristan Forinti" },
  { "No": 44, "Kodu": "MYR", "Adı": "Malezya Ringgiti" },
  { "No": 45, "Kodu": "MXN", "Adı": "Meksika Pesosu" },
  { "No": 46, "Kodu": "EGP", "Adı": "Mısır Lirası" },
  { "No": 47, "Kodu": "BBD", "Adı": "Barbados Doları" },
  { "No": 48, "Kodu": "PLN", "Adı": "Polonya Zlotisi" },
  { "No": 49, "Kodu": "PTE", "Adı": "Portekiz Escudosu" },
  { "No": 50, "Kodu": "ROL", "Adı": "Romen Leyi" },
  { "No": 51, "Kodu": "RUB", "Adı": "Rus Rublesi" },
  { "No": 52, "Kodu": "TWD", "Adı": "Tayvan Doları" },
  { "No": 53, "Kodu": "TRY", "Adı": "Türk Lirası" },
  { "No": 54, "Kodu": "JOD", "Adı": "Ürdün Dinarı" },
  { "No": 55, "Kodu": "GRD", "Adı": "Yunan Drahmisi" },
  { "No": 56, "Kodu": "ARS", "Adı": "Arjantin Pesosu" },
  { "No": 57, "Kodu": "LAK", "Adı": "Laos Kipi" },
  { "No": 58, "Kodu": "AOA", "Adı": "Andorra Pesetası" },
  { "No": 59, "Kodu": "AED", "Adı": "BAE Dirhemi" },
  { "No": 60, "Kodu": "AFN", "Adı": "Afganistan Afganisi" },
  { "No": 61, "Kodu": "ALL", "Adı": "Arnavutluk Leki" },
  { "No": 62, "Kodu": "ANG", "Adı": "Hollanda Antilleri Florini" },
  { "No": 63, "Kodu": "ADP", "Adı": "Angola Kwanzası" },
  { "No": 64, "Kodu": "BDT", "Adı": "Bengaldeş Takası" },
  { "No": 65, "Kodu": "BHD", "Adı": "Bahreyn Dinarı" },
  { "No": 66, "Kodu": "BIF", "Adı": "Burundi Frangı" },
  { "No": 67, "Kodu": "BMD", "Adı": "Bermuda Doları" },
  { "No": 68, "Kodu": "BND", "Adı": "Brunei Doları" },
  { "No": 69, "Kodu": "BOB", "Adı": "Bolivya Bolivianosu" },
  { "No": 70, "Kodu": "BSD", "Adı": "Bahama Doları" },
  { "No": 71, "Kodu": "BTN", "Adı": "Butan Lirası" },
  { "No": 72, "Kodu": "BWP", "Adı": "Botswana Pulası" },
  { "No": 73, "Kodu": "BZD", "Adı": "Belize Doları" },
  { "No": 74, "Kodu": "CLP", "Adı": "Şili Pesosu" },
  { "No": 75, "Kodu": "COP", "Adı": "Kolombiya Pesosu" },
  { "No": 76, "Kodu": "CRC", "Adı": "Kosta Rika Kolonu" },
  { "No": 77, "Kodu": "CUP", "Adı": "Küba Pesosu" },
  { "No": 78, "Kodu": "CVE", "Adı": "Cape Verde Esküdosu" },
  { "No": 79, "Kodu": "DJF", "Adı": "Cibuti Frangı" },
  { "No": 80, "Kodu": "DOP", "Adı": "Dominik Pesosu" },
  { "No": 81, "Kodu": "DZD", "Adı": "Cezayir Dinarı" },
  { "No": 82, "Kodu": "ECS", "Adı": "Ekvator Sucresi" },
  { "No": 83, "Kodu": "ETB", "Adı": "Etyopya Birri" },
  { "No": 84, "Kodu": "FJD", "Adı": "Fiji Adaları Doları" },
  { "No": 85, "Kodu": "FKP", "Adı": "Falkland Adaları Sterlini" },
  { "No": 86, "Kodu": "GHS", "Adı": "Gana Cedisi" },
  { "No": 87, "Kodu": "GIP", "Adı": "Cebelitarık Sterlini" },
  { "No": 88, "Kodu": "GMD", "Adı": "Gambia Dalasisi" },
  { "No": 89, "Kodu": "GNF", "Adı": "Gine Frangı" },
  { "No": 90, "Kodu": "GTQ", "Adı": "Guatemala Quetzali" },
  { "No": 91, "Kodu": "GWP", "Adı": "Gine-Bisse Pesosu" },
  { "No": 92, "Kodu": "GYD", "Adı": "Guyana Doları" },
  { "No": 93, "Kodu": "HNL", "Adı": "Honduras Lempirası" },
  { "No": 94, "Kodu": "HTG", "Adı": "Haiti Gourdesi" },
  { "No": 95, "Kodu": "IDR", "Adı": "Endonezya Rupisi" },
  { "No": 96, "Kodu": "JMD", "Adı": "Jamaika Doları" },
  { "No": 97, "Kodu": "KES", "Adı": "Kenya Şilingi" },
  { "No": 98, "Kodu": "KHR", "Adı": "Kamboçya Rieli" },
  { "No": 99, "Kodu": "KMF", "Adı": "Komor Frangi" },
  { "No": 100, "Kodu": "KPW", "Adı": "Kuzey Kore Wonu" },
  { "No": 101, "Kodu": "KRW", "Adı": "Güney Kore Wonu" },
  { "No": 102, "Kodu": "KYD", "Adı": "Cayman Adaları Doları" },
  { "No": 103, "Kodu": "LKR", "Adı": "Sri Lanka Rupisi" },
  { "No": 104, "Kodu": "LRD", "Adı": "Liberya Doları" },
  { "No": 105, "Kodu": "LSL", "Adı": "Lesoto Lotisi" },
  { "No": 106, "Kodu": "MAD", "Adı": "Fas Dirhemi" },
  { "No": 107, "Kodu": "MNT", "Adı": "Moğol Tugriki" },
  { "No": 108, "Kodu": "MOP", "Adı": "Macau Patacası" },
  { "No": 109, "Kodu": "MRO", "Adı": "Moritanya Ogiyası" },
  { "No": 110, "Kodu": "MTL", "Adı": "Malta Lirası" },
  { "No": 111, "Kodu": "MUR", "Adı": "Mauritius Rupisi" },
  { "No": 112, "Kodu": "MVR", "Adı": "Maldiv Rufiyası" },
  { "No": 113, "Kodu": "MWK", "Adı": "Malavi Kwachası" },
  { "No": 114, "Kodu": "MZN", "Adı": "Mozambik Meticali" },
  { "No": 115, "Kodu": "NGN", "Adı": "Nijerya Nairası" },
  { "No": 116, "Kodu": "NIO", "Adı": "Nikaragua Cordoba Orosu" },
  { "No": 117, "Kodu": "NPR", "Adı": "Nepal Rupisi" },
  { "No": 118, "Kodu": "NZD", "Adı": "Yeni Zelanda Doları" },
  { "No": 119, "Kodu": "OMR", "Adı": "Umman Riyali" },
  { "No": 120, "Kodu": "PAB", "Adı": "Panama Balboası" },
  { "No": 121, "Kodu": "PEN", "Adı": "Peru Solu" },
  { "No": 122, "Kodu": "PGK", "Adı": "Papua Yeni Gine Kinası" },
  { "No": 123, "Kodu": "PHP", "Adı": "Filipin Pesosu" },
  { "No": 124, "Kodu": "PKR", "Adı": "Pakistan Rupisi" },
  { "No": 125, "Kodu": "PYG", "Adı": "Paraguay Guaranisi" },
  { "No": 126, "Kodu": "QAR", "Adı": "Katar Riyali" },
  { "No": 127, "Kodu": "RWF", "Adı": "Ruanda Frangı" },
  { "No": 128, "Kodu": "SBD", "Adı": "Solomon Adaları Doları" },
  { "No": 129, "Kodu": "SCR", "Adı": "Seyşel Adaları Rupisi" },
  { "No": 130, "Kodu": "SDG", "Adı": "Sudan Dinarı" },
  { "No": 131, "Kodu": "SGD", "Adı": "Singapur Doları" },
  { "No": 132, "Kodu": "SHP", "Adı": "St. Helen Lirası" },
  { "No": 133, "Kodu": "SLL", "Adı": "Sierra Leone Leonesi" },
  { "No": 134, "Kodu": "SOS", "Adı": "Somali Şilini" },
  { "No": 135, "Kodu": "SRD", "Adı": "Surinam Florini" },
  { "No": 136, "Kodu": "STD", "Adı": "Sao Tome Dobrası" },
  { "No": 137, "Kodu": "SVC", "Adı": "El Salvador Colonu" },
  { "No": 138, "Kodu": "SYP", "Adı": "Suriye Lirası" },
  { "No": 139, "Kodu": "SZL", "Adı": "Swaziland Lilangenisi" },
  { "No": 140, "Kodu": "THB", "Adı": "Tayland Bahtı" },
  { "No": 141, "Kodu": "TND", "Adı": "Tunus Dinarı" },
  { "No": 142, "Kodu": "TPE", "Adı": "Doğu Timor Esküdosu" },
  { "No": 143, "Kodu": "TTD", "Adı": "Trinidad ve Tobago Doları" },
  { "No": 144, "Kodu": "TZS", "Adı": "Tanzanya Şilini" },
  { "No": 145, "Kodu": "UGX", "Adı": "Uganda Şilini" },
  { "No": 146, "Kodu": "UYU", "Adı": "Uruguay Pesosu" },
  { "No": 147, "Kodu": "VEB", "Adı": "Venezuella Bolivarı" },
  { "No": 148, "Kodu": "VND", "Adı": "Vietnam Dongu" },
  { "No": 149, "Kodu": "WST", "Adı": "Samoa Talası" },
  { "No": 150, "Kodu": "YDD", "Adı": "Yemen Dinarı" },
  { "No": 151, "Kodu": "YER", "Adı": "Yemen Riyali" },
  { "No": 152, "Kodu": "YUD", "Adı": "Yugoslav Dinarı" },
  { "No": 153, "Kodu": "ZAR", "Adı": "Güney Afrika Randı" },
  { "No": 154, "Kodu": "ZMK", "Adı": "Zambiya Kwachası" },
  { "No": 155, "Kodu": "ZWL", "Adı": "Zimbabwe Doları" },
  { "No": 156, "Kodu": "KZT", "Adı": "Kazak Tengesi" },
  { "No": 157, "Kodu": "UAH", "Adı": "Ukrayna Grevniyası" },
  { "No": 158, "Kodu": "TMT", "Adı": "Türkmenistan Manatı" },
  { "No": 159, "Kodu": "UZS", "Adı": "Özbekistan Somu" },
  { "No": 160, "Kodu": "TL", "Adı": "Türk Lirası" },
  { "No": 161, "Kodu": "RON", "Adı": "Romen Yeni Leyi" },
  { "No": 162, "Kodu": "AZN", "Adı": "Azerbaycan Yeni Manatı" },
  { "No": 164, "Kodu": "AMD", "Adı": "Ermeni Dramı" },
  { "No": 165, "Kodu": "AWG", "Adı": "Aruba Florini" },
  { "No": 166, "Kodu": "KM", "Adı": "Konvertibıl Mark" },
  { "No": 167, "Kodu": "BYR", "Adı": "Beyaz Rusya Rublesi" },
  { "No": 168, "Kodu": "CDF", "Adı": "Kongo Frangı" },
  { "No": 169, "Kodu": "ERN", "Adı": "Eritre Nakfası" },
  { "No": 170, "Kodu": "HRK", "Adı": "Hırvatistsan Kunası" },
  { "No": 171, "Kodu": "MDL", "Adı": "Moldova Leyi" },
  { "No": 172, "Kodu": "MGA", "Adı": "Malgaş ariarysi" },
  { "No": 173, "Kodu": "MKD", "Adı": "Makedonya Dinarı" },
  { "No": 174, "Kodu": "MMK", "Adı": "Kyat" },
  { "No": 175, "Kodu": "NAD", "Adı": "Namibya Doları" },
  { "No": 176, "Kodu": "RSD", "Adı": "Sırp Dinarı" },
  { "No": 177, "Kodu": "TJS", "Adı": "Somoni" },
  { "No": 178, "Kodu": "TOP", "Adı": "Pa'anga" },
  { "No": 179, "Kodu": "VEF", "Adı": "Venezuela Bolivarı" },
  { "No": 180, "Kodu": "VUV", "Adı": "Vanuatu Vatusu" },
  { "No": 181, "Kodu": "XAF", "Adı": "Central African CFA Franc" },
  { "No": 182, "Kodu": "XCD", "Adı": "Doğu Karayip Doları" },
  { "No": 183, "Kodu": "XOF", "Adı": "CFA Frangı" },
  { "No": 184, "Kodu": "XPF", "Adı": "CFP Frangı" },
  { "No": 185, "Kodu": "AU", "Adı": "Altın" },
  { "No": 186, "Kodu": "AG", "Adı": "Gümüş" },
  { "No": 187, "Kodu": "PT", "Adı": "Platin" },
  { "No": 188, "Kodu": "PD", "Adı": "Paladyum" }
];

// En çok kullanılan kurlar
export const POPULAR_CURRENCIES: Currency[] = [
  { "No": 53, "Kodu": "TRY", "Adı": "Türk Lirası" },
  { "No": 1, "Kodu": "USD", "Adı": "ABD Doları" },
  { "No": 20, "Kodu": "EUR", "Adı": "Euro" }
];

// Kur No'su ile kur bilgisini bul
export const getCurrencyByNo = (no: number): Currency | undefined => {
  return CURRENCIES.find(currency => currency.No === no);
};

// Kur kodu ile kur bilgisini bul
export const getCurrencyByCode = (code: string): Currency | undefined => {
  return CURRENCIES.find(currency => currency.Kodu === code);
}; 