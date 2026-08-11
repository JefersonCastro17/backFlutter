import * as dotenv from 'dotenv';
import * as path from 'path';

// Force load .env.test before any module imports
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
