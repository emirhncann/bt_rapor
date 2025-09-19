'use client';

import { useState, useEffect } from 'react';

interface Company {
  id?: number;
  // Firma Bilgileri
  company_name: string;
  company_email: string;
  tax_no: string;
  tax_office: string;
  address?: string;
  // Yönetici Bilgileri
  admin_name: string;
  admin_email: string;
  admin_password: string;
  // Lisans Bilgileri
  license_key: string;
  license_end: string;
  plan_ref: string;
  has_module: boolean;
  // Sistem Bilgileri
  company_ref: string;
  is_active: boolean;
}

interface Plan {
  id: number;
  plan_name: string;
  plan_description: string;
}

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (company: Company) => void;
  company?: Company | null;
  title: string;
}

export default function CompanyModal({ isOpen, onClose, onSave, company, title }: CompanyModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Company>({
    // Firma Bilgileri
    company_name: '',
    company_email: '',
    tax_no: '',
    tax_office: '',
    address: '',
    // Yönetici Bilgileri
    admin_name: '',
    admin_email: '',
    admin_password: '',
    // Lisans Bilgileri
    license_key: '',
    license_end: '',
    plan_ref: '',
    has_module: false,
    // Sistem Bilgileri
    company_ref: '',
    is_active: true
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    if (isOpen) {
      loadPlans();
      if (company) {
        setFormData(company);
      } else {
        setFormData({
          // Firma Bilgileri
          company_name: '',
          company_email: '',
          tax_no: '',
          tax_office: '',
          address: '',
          // Yönetici Bilgileri
          admin_name: '',
          admin_email: '',
          admin_password: '',
          // Lisans Bilgileri
          license_key: '',
          license_end: '',
          plan_ref: '',
          has_module: false,
          // Sistem Bilgileri
          company_ref: '',
          is_active: true
        });
      }
      setErrors({});
      setCurrentStep(1);
    }
  }, [isOpen, company]);

  const loadPlans = async () => {
    try {
      const response = await fetch('/api/super-admin/plans');
      const data = await response.json();
      
      if (data.status === 'success') {
        setPlans(data.data || []);
      }
    } catch (error) {
      console.error('Planlar yüklenirken hata:', error);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (step === 1) {
      // Firma Bilgileri Validasyonu
      if (!formData.company_name.trim()) {
        newErrors.company_name = 'Şirket adı gereklidir';
      }

      if (!formData.company_email.trim()) {
        newErrors.company_email = 'Şirket email adresi gereklidir';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.company_email)) {
        newErrors.company_email = 'Geçerli bir email adresi giriniz';
      }

      if (!formData.tax_no.trim()) {
        newErrors.tax_no = 'Vergi numarası gereklidir';
      } else if (!/^\d{10}$/.test(formData.tax_no.replace(/\s/g, ''))) {
        newErrors.tax_no = 'Vergi numarası 10 haneli olmalıdır';
      }

      if (!formData.tax_office.trim()) {
        newErrors.tax_office = 'Vergi dairesi gereklidir';
      }
    } else if (step === 2) {
      // Yönetici Bilgileri Validasyonu
      if (!formData.admin_name.trim()) {
        newErrors.admin_name = 'Yönetici adı gereklidir';
      }

      if (!formData.admin_email.trim()) {
        newErrors.admin_email = 'Yönetici email adresi gereklidir';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
        newErrors.admin_email = 'Geçerli bir email adresi giriniz';
      }

      if (!formData.admin_password.trim()) {
        newErrors.admin_password = 'Şifre gereklidir';
      }
    } else if (step === 3) {
      // Lisans Bilgileri Validasyonu

      if (!formData.license_end.trim()) {
        newErrors.license_end = 'Lisans bitiş tarihi gereklidir';
      } else {
        const endDate = new Date(formData.license_end);
        const today = new Date();
        if (endDate <= today) {
          newErrors.license_end = 'Lisans bitiş tarihi bugünden sonra olmalıdır';
        }
      }

      if (!formData.plan_ref.trim()) {
        newErrors.plan_ref = 'Plan referansı gereklidir';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep < 4) {
      handleNext();
      return;
    }

    // Son adımda tüm validasyonları kontrol et
    const allValid = [1, 2, 3].every(step => validateStep(step));
    if (!allValid) {
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Şirket kaydedilirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Company, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  if (!isOpen) return null;

  const steps = [
    { id: 1, title: 'Firma Bilgileri', icon: '🏢' },
    { id: 2, title: 'Yönetici Bilgileri', icon: '👤' },
    { id: 3, title: 'Lisans Bilgileri', icon: '🔑' },
    { id: 4, title: 'Modül Seçimi', icon: '📦' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500 mt-1">Adım {currentStep}/4: {steps[currentStep - 1]?.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step.id 
                      ? 'bg-blue-600 border-blue-600 text-white' 
                      : 'border-gray-300 text-gray-400'
                  }`}>
                    <span className="text-sm font-medium">{step.id}</span>
                  </div>
                  <div className="ml-3 hidden sm:block">
                    <p className={`text-sm font-medium ${
                      currentStep >= step.id ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`hidden sm:block w-16 h-0.5 mx-4 ${
                      currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Firma Bilgileri */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">🏢 Firma Bilgileri</h3>
                  <p className="text-blue-700 text-sm">Şirketin temel bilgilerini giriniz</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Şirket Adı *
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.company_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Şirket adını giriniz"
                    />
                    {errors.company_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.company_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Şirket Email *
                    </label>
                    <input
                      type="email"
                      value={formData.company_email}
                      onChange={(e) => handleInputChange('company_email', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.company_email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="info@sirket.com"
                    />
                    {errors.company_email && (
                      <p className="mt-1 text-sm text-red-600">{errors.company_email}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vergi Numarası *
                    </label>
                    <input
                      type="text"
                      value={formData.tax_no}
                      onChange={(e) => handleInputChange('tax_no', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.tax_no ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="1234567890"
                      maxLength={10}
                    />
                    {errors.tax_no && (
                      <p className="mt-1 text-sm text-red-600">{errors.tax_no}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vergi Dairesi *
                    </label>
                    <input
                      type="text"
                      value={formData.tax_office}
                      onChange={(e) => handleInputChange('tax_office', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.tax_office ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Kadıköy Vergi Dairesi"
                    />
                    {errors.tax_office && (
                      <p className="mt-1 text-sm text-red-600">{errors.tax_office}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adres
                  </label>
                  <textarea
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Şirket adresini giriniz"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Yönetici Bilgileri */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">👤 Yönetici Bilgileri</h3>
                  <p className="text-green-700 text-sm">Şirket yöneticisinin bilgilerini giriniz</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yönetici Adı *
                    </label>
                    <input
                      type="text"
                      value={formData.admin_name}
                      onChange={(e) => handleInputChange('admin_name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.admin_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ad Soyad"
                    />
                    {errors.admin_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.admin_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yönetici Email *
                    </label>
                    <input
                      type="email"
                      value={formData.admin_email}
                      onChange={(e) => handleInputChange('admin_email', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.admin_email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="yonetici@sirket.com"
                    />
                    {errors.admin_email && (
                      <p className="mt-1 text-sm text-red-600">{errors.admin_email}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Şifre *
                  </label>
                  <input
                    type="password"
                    value={formData.admin_password}
                    onChange={(e) => handleInputChange('admin_password', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.admin_password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Şifre"
                  />
                  {errors.admin_password && (
                    <p className="mt-1 text-sm text-red-600">{errors.admin_password}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Lisans Bilgileri */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">🔑 Lisans Bilgileri</h3>
                  <p className="text-purple-700 text-sm">Şirket lisans bilgilerini giriniz</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lisans Anahtarı
                    </label>
                    <input
                      type="text"
                      value={formData.license_key}
                      onChange={(e) => handleInputChange('license_key', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.license_key ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="LIC-XXXX-XXXX-XXXX"
                    />
                    {errors.license_key && (
                      <p className="mt-1 text-sm text-red-600">{errors.license_key}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lisans Bitiş Tarihi *
                    </label>
                    <input
                      type="date"
                      value={formData.license_end}
                      onChange={(e) => handleInputChange('license_end', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.license_end ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.license_end && (
                      <p className="mt-1 text-sm text-red-600">{errors.license_end}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan Referansı *
                  </label>
                  <select
                    value={formData.plan_ref}
                    onChange={(e) => handleInputChange('plan_ref', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.plan_ref ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Plan seçiniz</option>
                    <option value="temel">Temel Plan</option>
                    <option value="standart">Standart Plan</option>
                    <option value="premium">Premium Plan</option>
                  </select>
                  {errors.plan_ref && (
                    <p className="mt-1 text-sm text-red-600">{errors.plan_ref}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Modül Seçimi */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">📦 Modül Seçimi</h3>
                  <p className="text-orange-700 text-sm">Şirket için aktif edilecek modülleri seçiniz</p>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.has_module}
                      onChange={(e) => handleInputChange('has_module', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Modül erişimi aktif</span>
                  </label>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Not:</strong> Modül seçimi özelliği yakında eklenecektir. 
                    Şu anda sadece modül erişimini aktif/pasif yapabilirsiniz.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 border-t border-gray-200">
              <div className="flex space-x-3">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    ← Önceki
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  İptal
                </button>
              </div>
              
              <div className="flex space-x-3">
                {currentStep < 4 ? (
                  <button
                    type="submit"
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Sonraki →
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Kaydediliyor...' : '✓ Kaydet'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
