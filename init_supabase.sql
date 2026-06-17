CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) NOT NULL,
    name VARCHAR DEFAULT '',
    phone VARCHAR DEFAULT '',
    city VARCHAR DEFAULT '',
    salary_min INTEGER DEFAULT 0,
    salary_max INTEGER DEFAULT 0,
    deal_breakers JSONB DEFAULT '[]',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    title VARCHAR DEFAULT '',
    company VARCHAR DEFAULT '',
    salary VARCHAR DEFAULT '',
    city VARCHAR DEFAULT '',
    platform VARCHAR DEFAULT '',
    jd_text TEXT DEFAULT '',
    match_score FLOAT DEFAULT 0.0,
    rating INTEGER DEFAULT 0,
    status VARCHAR DEFAULT 'new',
    jd_url VARCHAR DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    job_id INTEGER REFERENCES jobs(id) NOT NULL,
    status VARCHAR DEFAULT 'applied',
    applied_at TIMESTAMP DEFAULT NOW(),
    notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    content TEXT DEFAULT '',
    version INTEGER DEFAULT 1,
    file_type VARCHAR(10) DEFAULT 'md',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_preps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    job_id INTEGER REFERENCES jobs(id) NOT NULL,
    content JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedbacks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    type VARCHAR DEFAULT '',
    content TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    application_id INTEGER REFERENCES applications(id) NOT NULL,
    interview_date TIMESTAMP NOT NULL,
    questions_review TEXT DEFAULT '',
    self_rating INTEGER DEFAULT 3,
    interviewer_feedback TEXT DEFAULT '',
    improvements TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_cache (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) DEFAULT '',
    company VARCHAR(255) DEFAULT '',
    salary VARCHAR(100) DEFAULT '',
    city VARCHAR(100) DEFAULT '',
    country VARCHAR(50) DEFAULT '',
    platform VARCHAR(50) DEFAULT '',
    jd_text TEXT DEFAULT '',
    jd_url VARCHAR(1000) DEFAULT '',
    remote BOOLEAN DEFAULT FALSE,
    employment_type VARCHAR(50) DEFAULT '',
    categories JSONB DEFAULT '[]',
    raw_data JSONB DEFAULT '{}',
    fetched_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);
