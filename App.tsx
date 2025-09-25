/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { generateWatercolourPainting } from './geminiService';
import { Loader } from '@googlemaps/js-api-loader';

const GOOGLE_MAPS_API_KEY = "AIzaSyB11FjZtONZuCfq5yUFO-fbU2FcPVDrDWo";

const translations = {
    en: {
      title: 'Paint A Place',
      subtitle: 'Enter an address, then turn the satellite image into a watercolor painting.',
      addressLabel: 'Full Address',
      createWatercolor: '🎨 Create Watercolor',
      recreateWatercolor: '🎨 Re-create Watercolor',
      backToMap: '🗺️ Back to Map',
      downloadPainting: 'Download',
      generatingTitle: 'Creating your masterpiece...',
      generatingSubtitle: 'The AI is warming up its brushes. This may take a moment.',
      generatedTitle: 'Generated Watercolour Painting',
      generatedSubtitle: 'AI-generated from your 3D satellite view',
      mapPlaceholder: 'Map will be displayed here after submitting an address.',
      zoomAndTilt: 'Zoom and tilt for the best view! Better data gives better paintings 🥹',
      interpretationNote: 'Paintings are an interpretation of the building, and may not be perfectly accurate.',
      prettyNote: 'But they sure are pretty!',
      poweredBy: 'Powered by Gemini 2.5 Flash Image Preview',
      createdBy: 'Created by',
      viewHistory: '📜 View History',
      hideHistory: '🗺️ Back to App',
      historyTitle: 'Your Saved Paintings',
      historyEmpty: 'You haven\'t created any paintings yet. Go make some art!',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this painting?',
      preloaderText: 'Warming up the canvas... Finding your location.',
      placeholders: [
        "Eiffel Tower, Paris, France",
        "Your childhood home",
        "Buckingham Palace, London, UK",
        "The place you first met",
        "Statue of Liberty, New York, USA"
      ]
    },
    ar: {
      title: 'ارسم مكانًا',
      subtitle: 'أدخل عنوانًا، ثم حوّل صورة القمر الصناعي إلى لوحة مائية.',
      addressLabel: 'العنوان الكامل',
      createWatercolor: '🎨 إنشاء لوحة مائية',
      recreateWatercolor: '🎨 إعادة إنشاء لوحة مائية',
      backToMap: '🗺️ العودة إلى الخريطة',
      downloadPainting: 'تحميل',
      generatingTitle: 'جاري إنشاء تحفتك الفنية...',
      generatingSubtitle: 'الذكاء الاصطناعي يُجهز فُرَشه. قد يستغرق هذا بعض الوقت.',
      generatedTitle: 'اللوحة المائية التي تم إنشاؤها',
      generatedSubtitle: 'تم إنشاؤها بواسطة الذكاء الاصطناعي من عرض القمر الصناعي ثلاثي الأبعاد',
      mapPlaceholder: 'ستُعرض الخريطة هنا بعد إدخال العنوان.',
      zoomAndTilt: 'قرّب وأمِل للحصول على أفضل عرض! البيانات الأفضل تنتج لوحات أفضل 🥹',
      interpretationNote: 'اللوحات هي تفسير للمبنى، وقد لا تكون دقيقة تمامًا.',
      prettyNote: 'لكنها بالتأكيد جميلة!',
      poweredBy: 'مدعوم بواسطة Gemini 2.5 Flash Image Preview',
      createdBy: 'صُنع بواسطة',
      viewHistory: '📜 عرض السجل',
      hideHistory: '🗺️ العودة إلى التطبيق',
      historyTitle: 'لوحاتك المحفوظة',
      historyEmpty: 'لم تقم بإنشاء أي لوحات بعد. اذهب واصنع بعض الفن!',
      delete: 'حذف',
      confirmDelete: 'هل أنت متأكد أنك تريد حذف هذه اللوحة؟',
      preloaderText: 'نقوم بتجهيز لوحة الرسم... جاري تحديد موقعك.',
      placeholders: [
        "برج خليفة، دبي، الإمارات العربية المتحدة",
        "المسجد الحرام، مكة، المملكة العربية السعودية",
        "أبراج الكويت، مدينة الكويت، الكويت",
        "سوق واقف، الدوحة، قطر",
        "قلعة البحرين، المنامة، البحرين"
      ]
    }
};

type Language = keyof typeof translations;
type Theme = 'light' | 'dark';
interface HistoryItem {
    id: number;
    address: string;
    watercolourPainting: string;
    capturedMapImage: string;
}

const loader = new Loader({
    apiKey: GOOGLE_MAPS_API_KEY,
    version: "beta",
    libraries: ["places", "marker", "geocoding"],
});

const App: React.FC = () => {
    const [address, setAddress] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [mapInitialized, setMapInitialized] = useState<boolean>(false);
    const [isGeneratingPainting, setIsGeneratingPainting] = useState<boolean>(false);
    const [watercolourPainting, setWatercolourPainting] = useState<string>('');
    const [capturedMapImage, setCapturedMapImage] = useState<string>('');
    const [placeholder, setPlaceholder] = useState<string>('');

    // New state for preloading, theme, language, and history
    const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
    const [language, setLanguage] = useState<Language>('ar'); // Default to Arabic
    const [theme, setTheme] = useState<Theme>('dark'); // Default to dark mode
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [showHistory, setShowHistory] = useState<boolean>(false);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const markerInstanceRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
    const autocompleteRef = useRef<HTMLInputElement>(null);

    const t = (key: keyof (typeof translations)[Language]) => translations[language][key] || key;

    const initMap = useCallback(async (location: google.maps.LatLngLiteral, formattedAddr: string) => {
        if (!mapRef.current) return;
        console.log("Initializing map for address:", formattedAddr);

        const { Map } = await loader.importLibrary('maps');
        const { AdvancedMarkerElement } = await loader.importLibrary('marker');

        const mapOptions: google.maps.MapOptions = {
            center: location, zoom: 20, mapId: 'DEMO_MAP_ID', mapTypeId: 'satellite',
            tilt: 67.5, heading: 0, streetViewControl: false, mapTypeControl: false,
            fullscreenControl: false, zoomControl: true,
        };

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new Map(mapRef.current, mapOptions);
        } else {
            mapInstanceRef.current.setOptions(mapOptions);
        }

        if (markerInstanceRef.current) {
            markerInstanceRef.current.map = null;
        }
        
        markerInstanceRef.current = new AdvancedMarkerElement({
            position: location, map: mapInstanceRef.current, title: formattedAddr,
        });

        setMapInitialized(true);
        setWatercolourPainting('');
        setCapturedMapImage('');
    }, []);

    // Effect for app initialization, preloading, and geolocation
    useEffect(() => {
        const initializeApp = async () => {
            console.log("App mounted. Initializing...");

            const savedTheme = (localStorage.getItem('theme') as Theme | null) || 'dark';
            const savedLanguage = (localStorage.getItem('language') as Language | null) || 'ar';
            const savedHistory = localStorage.getItem('paintingHistory');

            setTheme(savedTheme);
            setLanguage(savedLanguage);
            if (savedHistory) setHistory(JSON.parse(savedHistory));
            console.log(`Preferences loaded - Theme: ${savedTheme}, Language: ${savedLanguage}`);

            if (navigator.geolocation) {
                console.log("Geolocation available. Attempting to get user position.");
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
                    });
                    
                    const { latitude, longitude } = position.coords;
                    console.log(`Geolocation success: Lat=${latitude}, Lng=${longitude}`);
                    
                    await loader.load();
                    const { Geocoder } = await loader.importLibrary('geocoding');
                    const geocoder = new Geocoder();
                    const { results } = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });

                    if (results && results[0]) {
                        const formattedAddr = results[0].formatted_address;
                        console.log("Reverse geocoding success:", formattedAddr);
                        setAddress(formattedAddr);
                        initMap({ lat: latitude, lng: longitude }, formattedAddr);
                    } else {
                        console.warn("Reverse geocoding failed to find an address.");
                    }
                } catch (error) {
                    // The Geolocation API returns a GeolocationPositionError object, not a standard Error.
                    // We need to access its properties to get a meaningful message.
                    let errorMessage = "An unknown error occurred.";
                    if (error && typeof error === 'object' && 'message' in error) {
                        errorMessage = String(error.message);
                    }
                    console.error(`Geolocation failed: ${errorMessage}`, error);
                }
            } else {
                console.log("Geolocation is not available in this browser.");
            }

            setIsAppLoading(false);
            console.log("Initialization complete. App is ready.");
        };

        initializeApp();
    }, [initMap]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
        console.log(`Theme changed to ${theme} and saved.`);
    }, [theme]);

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        localStorage.setItem('language', language);
        console.log(`Language changed to ${language} and saved.`);
    }, [language]);
    
    useEffect(() => {
        const currentPlaceholders = t('placeholders') as unknown as string[];
        setPlaceholder(currentPlaceholders[0]);
        const intervalId = setInterval(() => {
            setPlaceholder(currentPlaceholder => {
                const currentIndex = currentPlaceholders.indexOf(currentPlaceholder);
                const nextIndex = (currentIndex + 1) % currentPlaceholders.length;
                return currentPlaceholders[nextIndex];
            });
        }, 3000);

        return () => clearInterval(intervalId);
    }, [language, t]);

    useEffect(() => {
        let autocomplete: google.maps.places.Autocomplete;
        let listener: google.maps.MapsEventListener;

        loader.load().then(() => {
            if (autocompleteRef.current) {
                console.log("Initializing Google Places Autocomplete, restricted to GCC countries.");
                autocomplete = new google.maps.places.Autocomplete(autocompleteRef.current, {
                    types: ['address'],
                    componentRestrictions: { country: ["SA", "AE", "QA", "KW", "BH", "OM"] },
                });

                listener = autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.geometry?.location && place.formatted_address) {
                        console.log("Place selected:", place.formatted_address);
                        setAddress(place.formatted_address);
                        initMap(place.geometry.location.toJSON(), place.formatted_address);
                    } else {
                        console.warn("Selected place has no geometry or address.");
                    }
                });
            }
        });
        return () => { if (listener) listener.remove(); };
    }, [initMap]);

    const captureMapView = useCallback(async (): Promise<string> => {
        if (!mapInstanceRef.current) throw new Error("Map is not initialized.");
        console.log("Capturing map view as image...");
        const mapDiv = mapInstanceRef.current.getDiv();
        const canvas = await html2canvas(mapDiv, { useCORS: true, allowTaint: true });
        const dataUrl = canvas.toDataURL('image/png');
        console.log("Map view captured successfully.");
        return dataUrl;
    }, []);

    const handleShow3DView = async () => {
        setError(null);
        if (!address.trim()) {
            setError("Please enter an address.");
            return;
        }
        setIsLoading(true);
        console.info(`Geocoding address: "${address}"`);
        try {
            const { Geocoder } = await loader.importLibrary('geocoding');
            const geocoder = new Geocoder();
            const { results } = await geocoder.geocode({ address, componentRestrictions: { country: ["SA", "AE", "QA", "KW", "BH", "OM"] } });
            if (results && results[0]) {
                const location = results[0].geometry.location;
                const formattedAddr = results[0].formatted_address;
                setAddress(formattedAddr);
                initMap(location.toJSON(), formattedAddr);
            } else {
                const errorMsg = `Could not find a location for "${address}". Please try a more specific address.`;
                setError(errorMsg);
                console.error(errorMsg);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMsg);
            console.error("Geocoding failed:", err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateWatercolour = async () => {
        const isRerunning = !!watercolourPainting;
        setIsGeneratingPainting(true);
        setError(null);
        console.info('Starting watercolor generation process...');
    
        try {
            let imageToProcess: string;
    
            if (isRerunning && capturedMapImage) {
                imageToProcess = capturedMapImage;
                console.log("Re-running generation with cached map image.");
            } else {
                const newImageDataUrl = await captureMapView();
                setCapturedMapImage(newImageDataUrl);
                imageToProcess = newImageDataUrl;
            }
    
            const paintingDataUrl = await generateWatercolourPainting(imageToProcess);
            setWatercolourPainting(paintingDataUrl);
            console.log("Watercolor painting generated successfully.");
            
            const newHistoryItem: HistoryItem = {
                id: Date.now(),
                address: address,
                watercolourPainting: paintingDataUrl,
                capturedMapImage: imageToProcess
            };
            const updatedHistory = [newHistoryItem, ...history];
            setHistory(updatedHistory);
            localStorage.setItem('paintingHistory', JSON.stringify(updatedHistory));
            console.log('Painting saved to history:', newHistoryItem);

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to generate watercolor painting.";
            setError(errorMsg);
            console.error("Watercolor generation failed:", err);
            setWatercolourPainting('');
            setCapturedMapImage('');
        } finally {
            setIsGeneratingPainting(false);
        }
    };
    
    const handleBackToMap = () => {
        setWatercolourPainting('');
        setCapturedMapImage('');
    };

    const handleDownloadPainting = () => {
        if (!watercolourPainting) return;
        const link = document.createElement('a');
        link.href = watercolourPainting;
        const safeAddress = address.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `watercolour_${safeAddress || 'painting'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log("Painting downloaded:", link.download);
    };

    const handleDeleteHistoryItem = (id: number) => {
        if (window.confirm(t('confirmDelete') as string)) {
            const updatedHistory = history.filter(item => item.id !== id);
            setHistory(updatedHistory);
            localStorage.setItem('paintingHistory', JSON.stringify(updatedHistory));
            console.log(`Deleted history item with id: ${id}`);
        }
    };

    if (isAppLoading) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-300 gap-4 p-4 text-center">
                <svg className="w-16 h-16 text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1.5s" repeatCount="indefinite" />
                    </path>
                </svg>
                <h1 className="text-xl font-semibold">{t('preloaderText')}</h1>
            </div>
        );
    }
    
    const mainContent = (
        <>
            <div className="mb-4">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('addressLabel')}</label>
                <div className="relative">
                    <input
                        ref={autocompleteRef} type="text" id="address"
                        onChange={(e) => setAddress(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleShow3DView(); }}}
                        defaultValue={address}
                        disabled={isLoading || isGeneratingPainting}
                        className="w-full ps-4 pe-12 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        placeholder={placeholder}
                    />
                    <div className="absolute inset-y-0 end-0 flex items-center pe-3">
                        {isLoading ? (
                            <svg className="animate-spin h-5 w-5 text-gray-500 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <button type="button" onClick={handleShow3DView} disabled={isLoading || isGeneratingPainting} className="p-1 text-gray-500 rounded-full hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" aria-label="Search">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
                {mapInitialized && (
                    <button onClick={handleGenerateWatercolour} disabled={isGeneratingPainting} className="flex-grow min-w-[200px] bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105 shadow-md disabled:bg-green-400 disabled:cursor-not-allowed flex items-center justify-center h-12 whitespace-nowrap">
                        {isGeneratingPainting ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : (watercolourPainting ? t('recreateWatercolor') : t('createWatercolor'))}
                    </button>
                )}
                 {watercolourPainting && !isGeneratingPainting && (
                    <button onClick={handleBackToMap} className="flex-grow min-w-[200px] bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-transform transform hover:scale-105 shadow-md flex items-center justify-center h-12 whitespace-nowrap">
                        {t('backToMap')}
                    </button>
                )}
            </div>
            {error && <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-center" role="alert">{error}</div>}
            
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl h-[50vh] md:h-[55vh] shadow-inner overflow-hidden relative">
                <div ref={mapRef} className={`w-full h-full rounded-2xl transition-opacity duration-300 ${mapInitialized && !watercolourPainting && !isGeneratingPainting ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
                {!mapInitialized && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded-2xl">
                        <p className="text-gray-500 dark:text-gray-400 text-center px-4">{t('mapPlaceholder')}</p>
                    </div>
                )}
                {isGeneratingPainting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-2xl z-10 transition-opacity duration-300">
                        <div className="text-center text-white p-4">
                            <svg className="animate-spin h-10 w-10 text-white mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <h3 className="text-xl font-semibold">{t('generatingTitle')}</h3>
                            <p className="mt-2 text-gray-300">{t('generatingSubtitle')}</p>
                        </div>
                    </div>
                )}
                {watercolourPainting && !isGeneratingPainting && (
                    <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-800 rounded-2xl z-10 transition-opacity duration-300">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex-shrink-1">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('generatedTitle')}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{t('generatedSubtitle')}</p>
                            </div>
                            <button onClick={handleDownloadPainting} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md w-full sm:w-auto" aria-label="Download painting" title="Download painting">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                {t('downloadPainting')}
                            </button>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 min-h-0">
                            <img src={watercolourPainting} alt="Watercolor painting of the building" className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                        </div>
                    </div>
                )}
            </div>
            <div className='text-gray-500 dark:text-gray-400 mt-4 text-center text-sm space-y-1'>
                <p>{t('zoomAndTilt')}</p>
                <p>{t('interpretationNote')}</p>
                <p>{t('prettyNote')}</p>
            </div>
        </>
    );

    const historyContent = (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t('historyTitle')}</h2>
            {history.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('historyEmpty')}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {history.map(item => (
                        <div key={item.id} className="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden group relative">
                            <img src={item.watercolourPainting} alt={`Painting of ${item.address}`} className="w-full h-48 object-cover" />
                            <div className="p-4">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={item.address}>{item.address}</p>
                            </div>
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                                <button onClick={() => handleDeleteHistoryItem(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    {t('delete')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
    
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
              <style>{`.pac-container { z-index: 1050 !important; }`}</style>
              <div className="glowing-border bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
                  <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                      <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex-shrink-0">
                              <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.19922 2H16.7992L21.9992 8V18C21.9992 19.1046 21.1038 20 19.9992 20H3.99922C2.89466 20 1.99922 19.1046 1.99922 18V6C1.99922 3.79086 3.79008 2 5.99922 2H7.19922Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 18C14.2091 18 16 16.2091 16 14C16 11.7909 14.2091 10 12 10C9.79086 10 8 11.7909 8 14C8 16.2091 9.79086 18 12 18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7.19922 2L11.9992 8H16.7992" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <div>
                              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                              <span>EN</span>
                              <button onClick={() => setLanguage(lang => lang === 'en' ? 'ar' : 'en')} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${language === 'ar' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${language === 'ar' ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1'}`} />
                              </button>
                              <span>AR</span>
                          </div>
                          <button onClick={() => setTheme(theme => theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              {theme === 'light' ? 
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg> :
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                              }
                          </button>
                      </div>
                  </header>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-4">
                      <button onClick={() => setShowHistory(!showHistory)} className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md mb-6">
                          {showHistory ? t('hideHistory') : t('viewHistory')}
                      </button>
                      {showHistory ? historyContent : mainContent}
                  </div>
              </div>
              <footer className="mt-8 text-center text-sm">
                  <div className="flex flex-col items-center justify-center gap-4 text-neutral-500 dark:text-neutral-400">
                      <div className="flex-shrink-0">
                           <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.19922 2H16.7992L21.9992 8V18C21.9992 19.1046 21.1038 20 19.9992 20H3.99922C2.89466 20 1.99922 19.1046 1.99922 18V6C1.99922 3.79086 3.79008 2 5.99922 2H7.19922Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 18C14.2091 18 16 16.2091 16 14C16 11.7909 14.2091 10 12 10C9.79086 10 8 11.7909 8 14C8 16.2091 9.79086 18 12 18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7.19922 2L11.9992 8H16.7992" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div className="flex flex-col items-center justify-center gap-2">
                          <p className="whitespace-nowrap">{t('poweredBy')}</p>
                          <p>
                              {t('createdBy')}{' '}
                              <a href="https://x.com/leslienooteboom" target="_blank" rel="noopener noreferrer" className="font-semibold text-neutral-600 dark:text-neutral-300 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors duration-200">
                                  @leslienooteboom
                              </a>
                          </p>
                      </div>
                  </div>
              </footer>
            </div>
        </div>
    );
};

export default App;