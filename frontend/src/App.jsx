import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';

export default function App() {
  const [images, setImages] = useState([]);
  const [activeAddTool, setActiveAddTool] = useState('Whole Pill'); 
  const imageRefs = useRef({});
  const initialPinchDist = useRef({}); // Tracks touch distance for pinch-to-zoom

  // Standardizes AI output names to perfectly match manual tool names so they combine correctly
  const normalizeClass = (cls) => {
    if (!cls) return 'Whole Pill';
    const lower = cls.toLowerCase();
    if (lower.includes('half')) return 'Half Pill';
    if (lower.includes('quarter')) return 'Quarter Pill';
    if (lower.includes('other')) return 'Other';
    return 'Whole Pill';
  };

  const calculateTotalPills = (counts) => {
    let total = 0;
    Object.entries(counts).forEach(([cat, count]) => {
      if (cat === 'Half Pill') total += count * 0.5;
      else if (cat === 'Quarter Pill') total += count * 0.25;
      else if (cat === 'Other') total += 0; 
      else total += count * 1; 
    });
    return total;
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newImages = files.map(file => ({
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      file: file,
      url: URL.createObjectURL(file),
      status: 'analyzing',
      dots: [],
      categoryCounts: {},
      zoom: 100
    }));

    setImages(prev => [...prev, ...newImages]);

    for (const imgData of newImages) {
      processImage(imgData);
    }
    
    e.target.value = null;
  };

  const processImage = async (imgData) => {
    let compressedFile = imgData.file;
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };

    try {
      compressedFile = await imageCompression(imgData.file, options);
    } catch (error) {
      console.error("Compression error:", error);
    }

    const formData = new FormData();
    formData.append('file', compressedFile);

    try {
      const response = await fetch('https://pillcounter.onrender.com/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Network error");

      const data = await response.json();

      const newDots = data.dots.map((dot, index) => ({
        id: Date.now() + '-' + index,
        x: dot.x,
        y: dot.y,
        class: normalizeClass(dot.class) // Force AI classes to match manual classes
      }));

      const counts = newDots.reduce((acc, dot) => {
        acc[dot.class] = (acc[dot.class] || 0) + 1;
        return acc;
      }, {});

      setImages(prev => prev.map(img => 
        img.id === imgData.id 
          ? { ...img, status: 'done', dots: newDots, categoryCounts: counts } 
          : img
      ));
    } catch (error) {
      console.error("API Error:", error);
      setImages(prev => prev.map(img => 
        img.id === imgData.id ? { ...img, status: 'error' } : img
      ));
    }
  };

  const handleImageClick = (e, imageId) => {
    const imgRef = imageRefs.current[imageId];
    const imgState = images.find(img => img.id === imageId);
    
    if (!imgRef || imgState.status !== 'done') return;

    const rect = imgRef.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newDot = { id: Date.now(), x, y, class: activeAddTool };

    setImages(prev => prev.map(img => {
      if (img.id === imageId) {
        const updatedDots = [...img.dots, newDot];
        const updatedCounts = updatedDots.reduce((acc, dot) => {
          acc[dot.class] = (acc[dot.class] || 0) + 1;
          return acc;
        }, {});
        return { ...img, dots: updatedDots, categoryCounts: updatedCounts };
      }
      return img;
    }));
  };

  const removeDot = (e, imageId, dotId) => {
    e.stopPropagation();
    setImages(prev => prev.map(img => {
      if (img.id === imageId) {
        const updatedDots = img.dots.filter(dot => dot.id !== dotId);
        const updatedCounts = updatedDots.reduce((acc, dot) => {
          acc[dot.class] = (acc[dot.class] || 0) + 1;
          return acc;
        }, {});
        return { ...img, dots: updatedDots, categoryCounts: updatedCounts };
      }
      return img;
    }));
  };

  const handleZoom = (imageId, direction) => {
    setImages(prev => prev.map(img => {
      if (img.id === imageId) {
        let newZoom = img.zoom + (direction === 'in' ? 50 : -50);
        newZoom = Math.max(100, Math.min(newZoom, 400)); 
        return { ...img, zoom: newZoom };
      }
      return img;
    }));
  };

  // Touch event handlers for Pinch-to-Zoom
  const handleTouchStart = (e, imageId) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDist.current[imageId] = dist;
    }
  };

  const handleTouchMove = (e, imageId) => {
    if (e.touches.length === 2 && initialPinchDist.current[imageId]) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = currentDist - initialPinchDist.current[imageId];
      
      if (Math.abs(diff) > 30) { // Sensitivity threshold
        handleZoom(imageId, diff > 0 ? 'in' : 'out');
        initialPinchDist.current[imageId] = currentDist; // Reset to allow continuous fluid zooming
      }
    }
  };

  const handleTouchEnd = (e, imageId) => {
    initialPinchDist.current[imageId] = null;
  };

  return (
    // Increased bottom padding to pb-40 to comfortably clear the fixed bottom toolbar
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 pb-40 font-sans text-slate-800 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">

        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pill Counter AI</h1>
            <p className="text-slate-400 text-sm mt-1">Automated Detection & Verification</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 justify-center">
          <label className="flex-1 cursor-pointer bg-blue-600 text-white text-center px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-md">
            Upload Pictures
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <label className="flex-1 cursor-pointer bg-emerald-600 text-white text-center px-8 py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition shadow-md">
            Snap Picture
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>

        {images.map((img) => (
          <div key={img.id} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
            
            {/* Contextual Prompt Added Here */}
            {img.status === 'done' && (
              <div className="bg-blue-50 text-blue-800 border border-blue-200 px-4 py-2 rounded-lg text-center font-medium text-sm shadow-sm">
                Tap a dot to remove wrong count, tap image to add <span className="font-bold underline">{activeAddTool}</span>
              </div>
            )}

            <div className="relative w-full bg-slate-200 rounded-xl border-2 border-dashed border-slate-300 shadow-inner overflow-hidden">
              
              {img.status === 'done' && (
                <div className="absolute top-2 right-2 z-30 flex items-center gap-1 bg-white/90 p-1.5 rounded-lg shadow-md backdrop-blur-sm">
                  <button onClick={() => handleZoom(img.id, 'out')} disabled={img.zoom <= 100} className="w-8 h-8 bg-slate-100 rounded hover:bg-slate-200 text-lg font-bold disabled:opacity-50 text-slate-700">-</button>
                  <span className="text-sm font-semibold w-12 text-center text-slate-800">{img.zoom}%</span>
                  <button onClick={() => handleZoom(img.id, 'in')} disabled={img.zoom >= 400} className="w-8 h-8 bg-slate-100 rounded hover:bg-slate-200 text-lg font-bold disabled:opacity-50 text-slate-700">+</button>
                </div>
              )}

              {/* Added Touch Events to Viewport */}
              <div 
                className="w-full max-h-[60vh] overflow-auto touch-pan-x touch-pan-y"
                onTouchStart={(e) => handleTouchStart(e, img.id)}
                onTouchMove={(e) => handleTouchMove(e, img.id)}
                onTouchEnd={(e) => handleTouchEnd(e, img.id)}
              >
                <div 
                  className="relative cursor-crosshair leading-none origin-top-left transition-all duration-200" 
                  style={{ width: `${img.zoom}%` }}
                  onClick={(e) => handleImageClick(e, img.id)}
                >
                  <img 
                    ref={el => imageRefs.current[img.id] = el} 
                    src={img.url} 
                    alt="Pill tray" 
                    className="w-full h-auto block pointer-events-none" 
                  />

                  {img.status === 'done' && img.dots.map((dot) => {
                    let dotColor = "bg-emerald-400";
                    if (dot.class === 'Half Pill') dotColor = "bg-yellow-400";
                    else if (dot.class === 'Quarter Pill') dotColor = "bg-orange-400";
                    else if (dot.class === 'Other') dotColor = "bg-purple-400";

                    return (
                      <div 
                        key={dot.id} 
                        onClick={(e) => removeDot(e, img.id, dot.id)} 
                        className={`absolute w-4 h-4 ${dotColor} border-[1.5px] border-white rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer shadow hover:bg-red-500 hover:scale-150 transition-all z-20`}
                        style={{ top: `${dot.y}%`, left: `${dot.x}%` }} 
                        title={`Remove ${dot.class}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 font-medium text-slate-600">
                  Status: 
                  {img.status === 'analyzing' && <span className="text-purple-600 bg-purple-100 px-3 py-1 rounded-full text-sm animate-pulse">Roboflow AI counting...</span>}
                  {img.status === 'done' && <span className="text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full text-sm">Count Complete</span>}
                  {img.status === 'error' && <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full text-sm">Error processing</span>}
                </div>

                {img.status === 'done' && (
                  <div className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-black text-lg shadow-md flex items-center gap-2">
                    <span>Total Pill:</span>
                    <span>{calculateTotalPills(img.categoryCounts)}</span>
                  </div>
                )}
              </div>

              {img.status === 'done' && Object.keys(img.categoryCounts).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                  {Object.entries(img.categoryCounts).map(([cat, count]) => (
                    <div key={cat} className="bg-white px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 capitalize flex items-center gap-2 border border-slate-200 shadow-sm">
                      <span>{cat}</span>
                      <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ))}
        
        {images.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            No images uploaded yet.
          </div>
        )}

      </div>

      {images.some(img => img.status === 'done') && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md p-4 border-t border-slate-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] flex flex-col items-center gap-2 transition-all">
          <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto w-full">
            {['Whole Pill', 'Half Pill', 'Quarter Pill', 'Other'].map(tool => (
              <button
                key={tool}
                onClick={() => setActiveAddTool(tool)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm ${
                  activeAddTool === tool 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tool}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}