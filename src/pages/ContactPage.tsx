import React, { useState } from 'react';
import {
  Mail,
  Send,
  Check,
  AlertCircle,
  Copy,
  CheckCheck,
  Clock,
  ShieldCheck,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { PageMeta } from '../components/PageMeta';

const SUPPORT_EMAIL = 'adeshkumarchoudhary07@gmail.com';
const SUPPORT_NAME = 'FastPDFx Support';

const SUBJECT_PRESETS = [
  'Bug Report',
  'Feature Request',
  'Hindi / Language Support',
  'PDF Tool Feedback',
  'Image Tool Feedback',
  'General Question'
];

interface FormDataState {
  name: string;
  email: string;
  subject: string;
  message: string;
  honeypot: string; // Anti-bot hidden field
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState<FormDataState>({
    name: '',
    email: '',
    subject: '',
    message: '',
    honeypot: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [submittedData, setSubmittedData] = useState<{
    name: string;
    email: string;
    subject: string;
    timestamp: string;
  } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // Field validation
  const validateField = (field: keyof FormDataState, value: string): string | undefined => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Name is required.';
        if (value.trim().length < 2) return 'Name must be at least 2 characters.';
        return undefined;
      case 'email':
        if (!value.trim()) return 'Email address is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          return 'Please provide a valid email address.';
        }
        return undefined;
      case 'subject':
        if (!value.trim()) return 'Subject is required.';
        if (value.trim().length < 3) return 'Subject must be at least 3 characters.';
        return undefined;
      case 'message':
        if (!value.trim()) return 'Message content is required.';
        if (value.trim().length < 10) return 'Message must be at least 10 characters.';
        return undefined;
      default:
        return undefined;
    }
  };

  const handleChange = (
    field: keyof FormDataState,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      const err = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: err }));
    }
    if (serverError) setServerError(null);
  };

  const handleBlur = (field: keyof FormDataState) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const err = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: err }));
  };

  const validateAll = (): boolean => {
    const newErrors: FormErrors = {};
    (['name', 'email', 'subject', 'message'] as const).forEach(field => {
      const err = validateField(field, formData[field]);
      if (err) newErrors[field] = err;
    });

    setErrors(newErrors);
    setTouched({
      name: true,
      email: true,
      subject: true,
      message: true
    });

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Anti-bot check
    if (formData.honeypot) {
      setIsSuccess(true);
      return;
    }

    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Send directly via FormSubmit.co AJAX endpoint to adeshkumarchoudhary07@gmail.com
      const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(SUPPORT_EMAIL)}`;
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        _replyto: formData.email.trim(),
        subject: formData.subject.trim(),
        _subject: `[${SUPPORT_NAME}] ${formData.subject.trim()} - from ${formData.name.trim()}`,
        message: formData.message.trim(),
        _template: 'table',
        _captcha: 'false'
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}.`);
      }

      const result = await response.json();

      // Formsubmit responds with success: "true" or success: true
      if (result.success === 'true' || result.success === true || response.status === 200) {
        setSubmittedData({
          name: formData.name.trim(),
          email: formData.email.trim(),
          subject: formData.subject.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        setIsSuccess(true);
      } else {
        throw new Error(result.message || 'Delivery service was unable to accept message.');
      }
    } catch (err: unknown) {
      console.warn('Form submission encountered an error:', err);
      setServerError(
        'Unable to send message via automated delivery service. You can still reach us directly via email below.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const getMailtoLink = () => {
    const subj = encodeURIComponent(`[FastPDFx] ${formData.subject || 'Support Inquiry'}`);
    const body = encodeURIComponent(
      `Name: ${formData.name || ''}\nEmail: ${formData.email || ''}\n\nMessage:\n${formData.message || ''}`
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subj}&body=${body}`;
  };

  const handleResetForm = () => {
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: '',
      honeypot: ''
    });
    setErrors({});
    setTouched({});
    setServerError(null);
    setIsSuccess(false);
    setSubmittedData(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <PageMeta
        title="Contact Us — FastPDFx Support"
        description="Get in touch with FastPDFx Support for questions, bug reports, language issues, or feature suggestions. Prompt, personal assistance."
      />

      {/* Header section */}
      <div className="border border-[#DEDCD3] bg-white p-6 sm:p-8 rounded-[2px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#68735B]">
              <Mail className="w-3.5 h-3.5" />
              <span>Direct Support Channel</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#20201D]">
              Contact {SUPPORT_NAME}
            </h1>
            <p className="text-xs sm:text-sm text-[#57564F] leading-relaxed max-w-2xl">
              Have questions about client-side document processing, feedback on existing PDF or image tools, or need help with Hindi PDF conversion? Send us a message and our engineering team will respond directly to your email.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-mono text-[#57564F] border border-[#DEDCD3] px-3 py-1.5 bg-[#F5F3ED] rounded-[2px]">
              Response &lt; 24h
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Direct Info Cards */}
        <div className="space-y-4">
          {/* Email Card */}
          <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 space-y-3">
            <div className="w-9 h-9 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center border border-[#DEDCD3]">
              <Mail className="w-4 h-4 text-[#68735B]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#57564F] block">
                Primary Support Inbox
              </span>
              <span className="text-xs font-semibold text-[#20201D] block mt-0.5">
                {SUPPORT_NAME}
              </span>
            </div>

            <div className="p-2.5 bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-[#20201D] truncate select-all">
                {SUPPORT_EMAIL}
              </span>
              <button
                type="button"
                onClick={handleCopyEmail}
                title="Copy email to clipboard"
                className="p-1 hover:bg-white rounded-[2px] text-[#57564F] hover:text-[#20201D] transition-colors border border-transparent hover:border-[#DEDCD3]"
                aria-label="Copy email address"
              >
                {copiedEmail ? (
                  <CheckCheck className="w-3.5 h-3.5 text-[#68735B]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=FastPDFx%20Inquiry`}
              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 border border-[#DEDCD3] bg-white hover:bg-[#F5F3ED] text-[#20201D] text-xs font-medium rounded-[2px] transition-colors shadow-2xs"
            >
              <span>Open in Email App</span>
              <ExternalLink className="w-3 h-3 text-[#57564F]" />
            </a>
          </div>

          {/* SLA & Security Card */}
          <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#68735B]" />
              <h3 className="text-xs font-semibold text-[#20201D]">Response Standard</h3>
            </div>
            <p className="text-xs text-[#57564F] leading-relaxed">
              Inquiries sent via this form or direct email are delivered straight to <strong className="text-[#20201D] font-medium">{SUPPORT_EMAIL}</strong> and reviewed within 1 business day.
            </p>
          </div>

          {/* Privacy Notice Card */}
          <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#68735B]" />
              <h3 className="text-xs font-semibold text-[#20201D]">Document Privacy</h3>
            </div>
            <p className="text-xs text-[#57564F] leading-relaxed">
              Never attach confidential files directly in contact forms. Remember that all 8 FastPDFx tools run entirely in your local browser memory without uploading documents to our servers.
            </p>
          </div>
        </div>

        {/* Right Column: Functional Contact Form */}
        <div className="lg:col-span-2 bg-white rounded-[2px] border border-[#DEDCD3] p-6 sm:p-8">
          {isSuccess && submittedData ? (
            /* Success State */
            <div className="space-y-6">
              <div className="p-6 bg-[#F5F3ED] border border-[#68735B] rounded-[2px] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[2px] bg-[#68735B] text-white flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#20201D]">
                      Message Successfully Dispatched!
                    </h2>
                    <p className="text-xs text-[#57564F] mt-0.5">
                      Your note has been submitted to {SUPPORT_NAME} ({SUPPORT_EMAIL}).
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#DEDCD3] space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-mono text-[11px] uppercase text-[#57564F]">From:</span>
                    <span className="col-span-2 text-[#20201D] font-medium truncate">
                      {submittedData.name} ({submittedData.email})
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-mono text-[11px] uppercase text-[#57564F]">Subject:</span>
                    <span className="col-span-2 text-[#20201D] font-medium truncate">
                      {submittedData.subject}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-mono text-[11px] uppercase text-[#57564F]">Dispatched At:</span>
                    <span className="col-span-2 text-[#20201D] font-mono">
                      {submittedData.timestamp}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#20201D] text-[#F5F3ED] hover:bg-[#68735B] transition-colors rounded-[2px] text-xs font-semibold shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Send Another Message</span>
                </button>
                <a
                  href="/"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-[#DEDCD3] bg-white hover:bg-[#F5F3ED] text-[#20201D] transition-colors rounded-[2px] text-xs font-medium"
                >
                  <span>Return to Tools Directory</span>
                </a>
              </div>
            </div>
          ) : (
            /* Contact Form */
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="border-b border-[#DEDCD3] pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#20201D]">
                    Send a Message to Support
                  </h2>
                  <p className="text-xs text-[#57564F] mt-0.5">
                    Fields marked with an asterisk (*) are required.
                  </p>
                </div>
                <MessageSquare className="w-4 h-4 text-[#68735B]" />
              </div>

              {/* Server Error Banner */}
              {serverError && (
                <div className="p-4 bg-[#F5F3ED] border border-[#20201D] rounded-[2px] space-y-2">
                  <div className="flex items-start gap-2.5 text-xs text-[#20201D]">
                    <AlertCircle className="w-4 h-4 text-[#68735B] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{serverError}</p>
                      <p className="text-[11px] text-[#57564F] mt-1">
                        You can email us directly or open your desktop/mobile mail app using the button below:
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <a
                      href={getMailtoLink()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20201D] text-[#F5F3ED] hover:bg-[#68735B] text-xs font-medium rounded-[2px] transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send via Mail Client</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DEDCD3] hover:bg-white text-xs font-medium text-[#20201D] rounded-[2px] transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedEmail ? 'Email Copied!' : 'Copy Support Email'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Honeypot hidden input for anti-spam */}
              <input
                type="text"
                name="_honey"
                value={formData.honeypot}
                onChange={e => setFormData({ ...formData, honeypot: e.target.value })}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#20201D]"
                  >
                    Your Name <span className="text-[#68735B]">*</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    placeholder="e.g. Alex Sharma"
                    className={`w-full px-3.5 py-2.5 bg-white rounded-[2px] border text-xs text-[#20201D] placeholder:text-[#A6A49B] transition-colors focus:outline-none ${
                      touched.name && errors.name
                        ? 'border-red-600 focus:border-red-600 bg-red-50/20'
                        : 'border-[#DEDCD3] focus:border-[#20201D]'
                    } disabled:opacity-50`}
                    aria-invalid={!!(touched.name && errors.name)}
                    aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
                  />
                  {touched.name && errors.name && (
                    <p id="name-error" className="text-[11px] text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                {/* Email Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#20201D]"
                  >
                    Your Email <span className="text-[#68735B]">*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    disabled={isSubmitting}
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    placeholder="name@company.com"
                    className={`w-full px-3.5 py-2.5 bg-white rounded-[2px] border text-xs text-[#20201D] placeholder:text-[#A6A49B] transition-colors focus:outline-none ${
                      touched.email && errors.email
                        ? 'border-red-600 focus:border-red-600 bg-red-50/20'
                        : 'border-[#DEDCD3] focus:border-[#20201D]'
                    } disabled:opacity-50`}
                    aria-invalid={!!(touched.email && errors.email)}
                    aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                  />
                  {touched.email && errors.email && (
                    <p id="email-error" className="text-[11px] text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Subject Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="contact-subject"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#20201D]"
                  >
                    Subject <span className="text-[#68735B]">*</span>
                  </label>
                  <span className="text-[10px] text-[#57564F]">
                    Choose a preset or type your own
                  </span>
                </div>

                {/* Subject quick preset chips */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {SUBJECT_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleChange('subject', preset)}
                      className={`px-2 py-1 text-[11px] border rounded-[2px] transition-colors ${
                        formData.subject === preset
                          ? 'border-[#20201D] bg-[#20201D] text-[#F5F3ED]'
                          : 'border-[#DEDCD3] bg-[#F5F3ED] text-[#57564F] hover:text-[#20201D] hover:border-[#57564F]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <input
                  id="contact-subject"
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={formData.subject}
                  onChange={e => handleChange('subject', e.target.value)}
                  onBlur={() => handleBlur('subject')}
                  placeholder="e.g. Issue extracting Hindi text in PDF to Word"
                  className={`w-full px-3.5 py-2.5 bg-white rounded-[2px] border text-xs text-[#20201D] placeholder:text-[#A6A49B] transition-colors focus:outline-none ${
                    touched.subject && errors.subject
                      ? 'border-red-600 focus:border-red-600 bg-red-50/20'
                      : 'border-[#DEDCD3] focus:border-[#20201D]'
                  } disabled:opacity-50`}
                  aria-invalid={!!(touched.subject && errors.subject)}
                  aria-describedby={touched.subject && errors.subject ? 'subject-error' : undefined}
                />
                {touched.subject && errors.subject && (
                  <p id="subject-error" className="text-[11px] text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errors.subject}</span>
                  </p>
                )}
              </div>

              {/* Message Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#20201D]"
                  >
                    Message <span className="text-[#68735B]">*</span>
                  </label>
                  <span className="text-[10px] text-[#57564F]">
                    {formData.message.length} characters (min 10)
                  </span>
                </div>
                <textarea
                  id="contact-message"
                  rows={5}
                  required
                  disabled={isSubmitting}
                  value={formData.message}
                  onChange={e => handleChange('message', e.target.value)}
                  onBlur={() => handleBlur('message')}
                  placeholder="Please describe your question or issue in detail. If reporting a tool error, mention the tool name and file format..."
                  className={`w-full px-3.5 py-2.5 bg-white rounded-[2px] border text-xs text-[#20201D] placeholder:text-[#A6A49B] transition-colors focus:outline-none resize-y ${
                    touched.message && errors.message
                      ? 'border-red-600 focus:border-red-600 bg-red-50/20'
                      : 'border-[#DEDCD3] focus:border-[#20201D]'
                  } disabled:opacity-50`}
                  aria-invalid={!!(touched.message && errors.message)}
                  aria-describedby={touched.message && errors.message ? 'message-error' : undefined}
                />
                {touched.message && errors.message && (
                  <p id="message-error" className="text-[11px] text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errors.message}</span>
                  </p>
                )}
              </div>

              {/* Submit Button & Assurance */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#DEDCD3]">
                <div className="flex items-center gap-2 text-[11px] text-[#57564F]">
                  <HelpCircle className="w-3.5 h-3.5 text-[#68735B] shrink-0" />
                  <span>Delivered securely to {SUPPORT_NAME}.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#20201D] text-[#F5F3ED] hover:bg-[#68735B] transition-colors rounded-[2px] font-semibold text-xs shadow-xs disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[#F5F3ED] border-t-transparent rounded-full animate-spin"></div>
                      <span>Dispatching Message...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Message</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
