import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';

export default function App() {
  const [images, setImages] = useState([]);
  const imageRefs = useRef({});

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newImages = files.map(file => ({
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      file: file,
      url: URL.createObjectURL(file),
      status: 'analyzing',
      dots: [],
      categoryCounts: {}
    }));

    setImages(prev => [...prev, ...newImages]);

    for (const imgData of newImages) {
      processImage(imgData);
    }
    
    // Reset the input so the user can snap/upload more pictures immediately
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
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Network error");

      const data = await response.json();

      const newDots = data.dots.map((dot, index) => ({
        id: Date.now() + '-' + index,
        x: dot.x,
        y: dot.y,
        class: dot.class 
      }));

      const counts = newDots.reduce((acc, dot) => {
        const cat = dot.class || 'Manual Addition';
        acc[cat] = (acc[cat] || 0) + 1;
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

    const newDot = { id: Date.now(), x, y, class: 'Manual Addition' };

    setImages(prev => prev.map(img => {
      if (img.id === imageId) {
        const updatedDots = [...img.dots, newDot];
        const updatedCounts = updatedDots.reduce((acc, dot) => {
          const cat = dot.class || 'Manual Addition';
          acc[cat] = (acc[cat] || 0) + 1;
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
          const cat = dot.class || 'Manual Addition';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});
        return { ...img, dots: updatedDots, categoryCounts: updatedCounts };
      }
      return img;
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">

        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pill Counter AI</h1>
            <p className="text-slate-400 text-sm mt-1">Automated Detection & Verification</p>
          </div>
        </div>

        {/* Dual Input Buttons */}
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
          <div key={img.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
            
            <div className="relative w-full bg-slate-200 rounded-xl overflow-hidden min-h-[200px] flex items-center justify-center border-2 border-dashed border-slate-300 shadow-inner">
              <div className="relative w-full cursor-crosshair leading-none" onClick={(e) => handleImageClick(e, img.id)}>
                <img 
                  ref={el => imageRefs.current[img.id] = el} 
                  src={img.url} 
                  alt="Pill tray" 
                  className="w-full h-auto block" 
                />

                {img.status === 'done' && img.dots.map((dot) => (
                  <div 
                    key={dot.id} 
                    onClick={(e) => removeDot(e, img.id, dot.id)} 
                    className="absolute w-6 h-6 bg-emerald-400 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer shadow-md hover:bg-red-500 hover:scale-110 transition-all z-20" 
                    style={{ top: `${dot.y}%`, left: `${dot.x}%` }} 
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 font-medium text-slate-600">
                Status: 
                {img.status === 'analyzing' && <span className="text-purple-600 bg-purple-100 px-3 py-1 rounded-full text-sm animate-pulse">Roboflow AI counting...</span>}
                {img.status === 'done' && <span className="text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full text-sm">Count Complete</span>}
                {img.status === 'error' && <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full text-sm">Error processing</span>}
              </div>

              {img.status === 'done' && Object.keys(img.categoryCounts).length > 0 && (
                <div className="flex flex-wrap gap-2">
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
    </div>
  );
}