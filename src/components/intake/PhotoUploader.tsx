'use client';

import { useState, useEffect } from 'react';
import { PropertyType, PhotoType } from '@/types/database';

interface PhotoRequirement {
  type: PhotoType;
  label: string;
  reason: string;
}

const requirementsByPropertyType: Record<PropertyType, PhotoRequirement[]> = {
  residential: [
    { type: 'exterior_front', label: 'Front Exterior', reason: 'Establishes curb appeal, architectural style, and visible condition for the Board of Review.' },
    { type: 'exterior_rear', label: 'Rear Exterior', reason: 'Reveals additions, decks, or deferred maintenance not visible from the street.' },
    { type: 'exterior_east', label: 'Left Side', reason: 'Documents siding condition, window count, and any structural concerns.' },
    { type: 'exterior_west', label: 'Right Side', reason: 'Completes the exterior documentation. Assessors compare all four elevations.' },
    { type: 'interior_kitchen', label: 'Kitchen', reason: 'Kitchen condition heavily influences market value. Outdated kitchens support lower valuations.' },
    { type: 'interior_bathroom', label: 'Primary Bathroom', reason: 'Bathroom quality is a key comparable adjustment factor.' },
    { type: 'interior_living', label: 'Major Living Areas', reason: 'Documents overall interior condition, finishes, and floor coverings.' },
    { type: 'deferred_maintenance', label: 'Deferred Maintenance', reason: 'Critical evidence. Peeling paint, water damage, aging systems, or needed repairs all support a lower valuation.' },
  ],
  commercial: [
    { type: 'exterior_front', label: 'Front Exterior', reason: 'Primary facade and entrance condition.' },
    { type: 'exterior_rear', label: 'Rear Exterior', reason: 'Loading docks, service entrances, and rear condition.' },
    { type: 'exterior_east', label: 'Left Side', reason: 'Full perimeter documentation.' },
    { type: 'exterior_west', label: 'Right Side', reason: 'Complete exterior coverage.' },
    { type: 'interior_kitchen', label: 'Interior Common Areas', reason: 'Lobby, hallways, and shared spaces.' },
    { type: 'interior_bathroom', label: 'Restroom Facilities', reason: 'Condition of tenant amenities.' },
    { type: 'interior_living', label: 'Tenant Spaces', reason: 'Representative unit or office condition.' },
    { type: 'deferred_maintenance', label: 'Deferred Maintenance', reason: 'Roof issues, HVAC age, parking lot condition, and needed repairs.' },
    { type: 'interior_garage', label: 'Loading/Parking Area', reason: 'Parking capacity and condition affect commercial value.' },
    { type: 'aerial', label: 'Signage & Street View', reason: 'Visibility, signage condition, and neighborhood context.' },
  ],
  industrial: [
    { type: 'exterior_front', label: 'Front Exterior', reason: 'Primary building face and office entrance.' },
    { type: 'exterior_rear', label: 'Rear Exterior', reason: 'Dock doors, staging areas, and rear access.' },
    { type: 'exterior_east', label: 'Left Side', reason: 'Exterior wall condition and clearance.' },
    { type: 'exterior_west', label: 'Right Side', reason: 'Complete perimeter documentation.' },
    { type: 'interior_kitchen', label: 'Office Areas', reason: 'Office finish level affects overall valuation.' },
    { type: 'interior_living', label: 'Warehouse/Production Floor', reason: 'Clear height, column spacing, and floor condition.' },
    { type: 'interior_bathroom', label: 'Facilities', reason: 'Restroom and break area condition.' },
    { type: 'deferred_maintenance', label: 'Deferred Maintenance', reason: 'Roof leaks, floor damage, and aging mechanical systems.' },
    { type: 'interior_garage', label: 'Overhead Doors', reason: 'Door count, size, and condition impact industrial value.' },
    { type: 'structural_detail', label: 'Clearance Heights', reason: 'Interior clear height documentation with reference objects.' },
  ],
  land: [
    { type: 'exterior_front', label: 'Front/Street View', reason: 'Street frontage, access points, and road condition.' },
    { type: 'exterior_east', label: 'Left Boundary', reason: 'Boundary condition, neighboring properties.' },
    { type: 'exterior_west', label: 'Right Boundary', reason: 'Boundary condition and context.' },
    { type: 'aerial', label: 'Aerial/Overview', reason: 'Overall lot shape, topography, and any encumbrances if possible.' },
  ],
};

interface UploadedPhoto {
  type: PhotoType;
  name: string;
  preview: string;
  caption: string;
}

interface PhotoUploaderProps {
  propertyType: PropertyType;
  onPhotosChange: (photos: UploadedPhoto[]) => void;
  /** If provided, uploads each photo to the API. Return true on success. */
  onFileUpload?: (file: File, type: PhotoType, caption: string) => Promise<boolean>;
}

export default function PhotoUploader({ propertyType, onPhotosChange, onFileUpload }: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingType, setUploadingType] = useState<PhotoType | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const requirements = requirementsByPropertyType[propertyType];

  // Clean up blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      photos.forEach((p) => {
        if (p.preview.startsWith('blob:')) {
          URL.revokeObjectURL(p.preview);
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, []);

  const handleFileSelect = async (type: PhotoType, file: File) => {
    const caption = captions[type] ?? '';

    // If API upload callback is provided, upload first
    if (onFileUpload) {
      setUploadingType(type);
      const success = await onFileUpload(file, type, caption);
      setUploadingType(null);
      if (!success) return; // Upload failed — don't add to local state
    }

    const preview = URL.createObjectURL(file);
    const updated = [...photos.filter((p) => p.type !== type), { type, name: file.name, preview, caption }];
    setPhotos(updated);
    onPhotosChange(updated);
  };

  const handleCaptionChange = (type: PhotoType, value: string) => {
    setCaptions((prev) => ({ ...prev, [type]: value }));
    // Update caption on already-uploaded photo
    const existing = photos.find((p) => p.type === type);
    if (existing) {
      const updated = photos.map((p) => p.type === type ? { ...p, caption: value } : p);
      setPhotos(updated);
      onPhotosChange(updated);
    }
  };

  const isUploaded = (type: PhotoType) => photos.some((p) => p.type === type);
  const uploadedCount = photos.length;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-cream/60">
          <span className="text-gold font-semibold">{uploadedCount}</span> photo{uploadedCount !== 1 ? 's' : ''} uploaded
        </p>
        {uploadedCount > 0 && (
          <span className="text-xs font-medium text-gold/70 bg-gold/5 border border-gold/15 px-3 py-1 rounded-full">
            More photos = stronger case
          </span>
        )}
      </div>

      {/* Encouragement banner */}
      <div className="rounded-lg bg-gold/5 border border-gold/10 px-4 py-3">
        <p className="text-xs text-cream/50 leading-relaxed">
          Upload as many photos as you can. You have access the county assessor never had — especially inside your property. Every photo of damage, wear, or outdated conditions becomes evidence in your appeal.
        </p>
      </div>

      {/* Photo items */}
      <div className="space-y-4">
        {requirements.map((req) => {
          const uploaded = isUploaded(req.type);
          const photo = photos.find((p) => p.type === req.type);

          return (
            <div
              key={req.type}
              className={`
                rounded-xl border p-5 transition-all duration-200
                ${uploaded ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gold/10 bg-navy-deep/40'}
              `}
            >
              <div className="flex items-start gap-4">
                {/* Status icon */}
                <div
                  className={`
                    flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                    ${uploaded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gold/10 text-gold/50'}
                  `}
                >
                  {uploaded ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-cream">{req.label}</h4>
                  </div>
                  <p className="text-xs text-cream/40 mt-1 leading-relaxed">{req.reason}</p>

                  {/* Description field — tell us what we're looking at */}
                  <textarea
                    placeholder="Describe what this photo shows — e.g. &quot;Basement south wall, water stain from recurring leak, approx 4ft wide&quot;"
                    value={captions[req.type] ?? photo?.caption ?? ''}
                    onChange={(e) => handleCaptionChange(req.type, e.target.value)}
                    rows={2}
                    className="mt-3 w-full rounded-lg border border-gold/10 bg-navy-deep/60 px-3 py-2 text-xs text-cream/70 placeholder:text-cream/25 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20 resize-none transition-colors"
                  />

                  {/* Upload zone or thumbnail */}
                  {uploadingType === req.type ? (
                    <div className="mt-3 flex items-center gap-3 py-2">
                      <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-cream/40">Uploading...</span>
                    </div>
                  ) : uploaded && photo ? (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-emerald-500/20 bg-navy-deep/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.preview}
                          alt={req.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-cream/60 truncate max-w-[200px]">{photo.name}</p>
                        <button
                          onClick={() => {
                            const updated = photos.filter((p) => p.type !== req.type);
                            setPhotos(updated);
                            onPhotosChange(updated);
                          }}
                          className="text-xs text-red-400 hover:text-red-300 mt-1 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="mt-2 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gold/15 p-4 cursor-pointer hover:border-gold/30 hover:bg-gold/5 transition-all duration-200">
                      <svg className="w-5 h-5 text-gold/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm text-cream/40">
                        Drop photo here or click to upload
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(req.type, file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
