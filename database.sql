-- Create images table if it doesn't exist
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    
    -- File information
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL UNIQUE,  -- UUID-based filename
    file_size INTEGER NOT NULL,                    -- Original file size in bytes
    mime_type VARCHAR(50) NOT NULL,                -- image/jpeg, image/png, etc.
    
    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,                            -- Store error details if processing fails
    
    -- Thumbnail information (populated after processing)
    thumbnail_filename VARCHAR(255),               -- Generated thumbnail filename
    thumbnail_size INTEGER,                        -- Thumbnail size in bytes
    
    -- Timestamps
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);