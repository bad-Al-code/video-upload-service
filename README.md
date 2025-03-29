![test badge](https://github.com/bad-al-code/Typescript/actions/workflows/ci.yml/badge.svg)

# Video Upload Service

A microservice built with Node.js, TypeScript, Express, and Dcoker to handler videp uploads, store them on AWS s3, records metadata in a MySQL database, and provide status checks. Designed with a decoupled architecture in mind for future synchronous video processing.

## Core Features

- **Video Upload Endpoint:** Accepts `multipart/form-data` requests to upload video files.
- **File Validation:** Uses Multer middleware to validate incoming files based on configurable MIME types and size limits.
- **AWS S3 Integration:** Securely uploads the original video file directly to a configured AWS S3 bucket.
- **Database Persistence:** Records video metadata (ID, original name, S3 key, status, timestamps, etc.) in a MySQL database using Drizzle ORM.
- **Status Check Endpoint:** Provides an API endpoint to retrieve the details and current status of a video by its ID.
- **Configuration:** Uses environment variables (`.env` file) for easy configuration of ports, database credentials, AWS settings, etc. (Includes validation via Zod).
- **Dockerized:** Fully containerized using Docker and Docker Compose for consistent development and deployment environments (includes application and MySQL database).
- **Development Workflow:** Supports hot-reloading using `nodemon` within Docker Compose for efficient development.
- **Testing:** Includes unit/integration tests using Vitest and Supertest, with mocking for external dependencies (DB, S3).

## Tech Stack

- **Backend:** Node.js, TypeScript
- **Framework:** Express.js
- **Database:** MySQL
- **ORM:** Drizzle ORM
- **File Handling:** Multer
- **Cloud Storage:** AWS SDK v3 (for S3)
- **Validation:** Zod
- **Containerization:** Docker, Docker Compose
- **Testing:** Vitest, Supertest
- **Dev Tools:** `ts-node`, `nodemon`, Prettier, ESLint

## Prerequisites

Before you begin, ensure you have the folowing installed:

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/install/) (Usually included with Docker Desktop)
- [Git](https://git-scm.com/)
- An **AWS Account**
- An **AWS S3 Bucket** created in your desired region.
- **AWS Credentials** configured for your environment to allow access to the S3 bucket (`s3:PutObject`). Common methods:
  - **IAM Role:** (Recommended for AWS deployments like EC2/ECS) Assign a role with S3 permissions to the compute resource.
  - **Shared Credential File:** Configure `~/.aws/credentials` (Linux/macOS) or `C:\Users\USERNAME\.aws\credentials` (Windows) with your Access Key ID and Secret Access Key.
  - **Environment Variables:** Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, (and optionally `AWS_SESSION_TOKEN`) in the environment where the application runs. **Warning:** Avoid committing credentials directly to your code or `.env` file if the `.env` file itself is committed.

## Setup

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/bad-Al-code/TypeScript.git
    ```

2.  **Create Environment File:**
    Copy the example environment file to create your local configuration:
    ```bash
    cp .env.example .env
    ```
3.  **Configure Environment Variables (`.env`):**
    Open the `.env` file and fill in the required values, especially:

    - `DB_...`: Credentials for the MySQL database (user, password, db name). Defaults are provided that work with the included `docker-compose.yml`.
    - `AWS_S3_BUCKET_NAME`: The exact name of your S3 bucket.
    - `AWS_REGION`: The AWS region where your bucket is located (e.g., `us-east-1`).
    - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: Your AWS credentials. **Important:** For development, you can place them here _if you DO NOT commit the `.env` file_. A more secure practice for local development is using the shared credential file (`~/.aws/credentials`). The Docker Compose setup passes these variables to the container.

    _(See the Environment Variables section below for a full list)_

4.  **Install Dependencies (Handled by Docker Build):** You don't strictly need to run `npm install` locally unless you are developing outside of Docker, as the Docker build process handles it.

## Running the Application (Docker Compose)

This is the recommended way to run the service locally, as it includes the database.

1.  **Build and Start Services:**
    This command builds the application image (if it doesn't exist or `--build` is used) and starts the `app` and `mysql` services in detached mode.

    ```bash
    docker compose up --build -d
    ```

    _(Note: You might see a warning about the `version` attribute in `docker-compose.yaml` being obsolete; you can safely remove that line from the file.)_

2.  **Apply Database Migrations (Important!):**
    After the containers are up and the database is healthy (wait ~15-30 seconds), apply the Drizzle schema migrations. Run this command _once_ initially or whenever you have new migrations:

    ```bash
    docker compose exec app npm run db:push
    ```

    _(Alternatively, if using the full migration flow: `docker compose exec app npm run db:migrate`)_

3.  **Accessing the Service:**
    The service should now be running and accessible at `http://localhost:3000` (or the `PORT` specified in `.env`).

4.  **Hot Reloading:** The development setup uses `nodemon` inside the container. Changes made to files in the `./src` directory on your host machine will automatically trigger a rebuild and restart of the Node.js server within the container.

5.  **Viewing Logs:**

    ```bash
    docker compose logs -f        # View logs from all services
    docker compose logs -f app    # View logs from the application service only
    docker compose logs -f mysql  # View logs from the database service only
    ```

6.  **Stopping Services:**
    ```bash
    docker compose down         # Stop and remove containers, network
    # Add -v to remove the database data volume (USE WITH CAUTION!)
    # docker compose down -v
    ```

## API Endpoints

The API base path is `/api/v1`

### 1. Upload Video

- **Endpoint:** `POST /upload/video`
- **Description:** Uploads a video file.
- **Request Body:** `multipart/form-data`
  - **Field Name:** `videoFile` (This must contain the video file data).
- **Success Response (200 OK):**
  ```json
  {
    "message": "Video uploaded successfully. Processing initiated.",
    "videoId": "generated-uuid-string",
    "s3Key": "videos/generated-uuid-string.ext"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Invalid file type, file too large, or no file provided.
  - `500 Internal Server Error`: Database error, S3 upload error, or other server issues.
- **Example (`curl`):**
  ```bash
  curl -X POST http://localhost:3000/api/v1/upload/video \
       -F "videoFile=@/path/to/your/local/video.mp4" \
       -v
  ```

### 2. Get Video Details

- **Endpoint:** `GET /upload/videos/:videoId`
- **Description:** Retrieves the details and status of a previously uploaded video.
- **URL Parameter:**
  - `:videoId` (string, UUID format): The unique ID of the video returned during upload.
- **Success Response (200 OK):**
  ```json
  {
    "message": "Video details retrieved successfully.",
    "data": {
      "id": "requested-uuid-string",
      "originalFilename": "uploaded-filename.mp4",
      "objectStorageKey": "videos/requested-uuid-string.mp4",
      "mimeType": "video/mp4",
      "sizeBytes": 12345678,
      "status": "PROCESSING", // Or PENDING_UPLOAD, READY, FAILED, etc.
      "title": null,
      "description": null,
      "durationSeconds": null,
      "createdAt": "2025-03-30T10:00:00.000Z", // ISO 8601 timestamp
      "updatedAt": "2025-03-30T10:00:05.000Z" // ISO 8601 timestamp
      // ... any other fields from the 'videos' table
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: If `:videoId` is not a valid UUID format.
  - `404 Not Found`: If no video exists with the provided `:videoId`.
  - `500 Internal Server Error`: Database query error or other server issues.
- **Example (`curl`):**
  ```bash
  # Replace YOUR_VIDEO_ID with an actual ID
  curl -X GET http://localhost:3000/api/v1/upload/videos/YOUR_VIDEO_ID -v
  ```

## Running Tests

Tests are written using Vitest and Supertest. Mocks are used for external dependencies (DB, S3, FS).

- **Run all tests once:**
  ```bash
  npm run test
  ```
- **Run tests in ui mode:**
  ```bash
  npm run test:ui
  ```
- **Run tests and generate coverage report:**

  ```bash
  npm run test:coverage
  ```

- **Run tests once:**
  ```bash
  npm run test:ci
  ```
  _(Coverage reports are saved in the `./coverage` directory)_

## Ba'ng Environment Variables

Create a `.env` file in the project root (yes you can copy `.env.example`) and configure the following variables
| Variable | Description | Default / Example | Required | Notes |
| :---------------------- | :-------------------------------------------------------------------------- | :----------------------------------- | :------- | :-------------------------------------------------------------------- |
| `PORT` | Port the Node.js application will listen on. | `3000` | No | |
| `DB_HOST` | Hostname for the MySQL database. | `mysql` | Yes | Use `mysql` for Docker Compose, `localhost` if running app locally. |
| `DB_PORT` | Port for the MySQL database. | `3306` | Yes | |
| `DB_NAME` | Name of the database to use. | `video_service_db` | Yes | Must match `MYSQL_DATABASE` in compose. |
| `DB_USER` | Username for connecting to the database. | `video_user` | Yes | Must match `MYSQL_USER` in compose. |
| `DB_PASSWORD` | Password for the database user. | `video_password` | Yes | Must match `MYSQL_PASSWORD` in compose. |
| `DB_ROOT_PASSWORD` | Root password for the MySQL container (used only by MySQL itself). | `supersecret_dev_root_password` | No | Only needed by the `mysql` service in compose. |
| `DATABASE_URL` | Full DSN connection string for Drizzle Kit commands. | (Derived from other DB vars) | Yes | Should use `mysql` as host for compose context. |
| `MAX_FILE_SIZE_MB` | Maximum allowed video upload size in Megabytes. | `100` | Yes | Used by Multer validation. |
| `AWS_S3_BUCKET_NAME` | Name of the AWS S3 bucket to upload videos to. | `your-s3-bucket-name` | Yes | **Replace with your actual bucket name!** |
| `AWS_REGION` | AWS Region where the S3 bucket is located. | `your-aws-region` | Yes | e.g., `us-east-1`, `ap-south-1`. **Replace!** |
| `AWS_ACCESS_KEY_ID` | Your AWS Access Key ID. | | Yes | **Handle securely!** Passed to container via compose. |
| `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Access Key. | | Yes | **Handle securely!** Passed to container via compose. |
| `AWS_SESSION_TOKEN` | Optional AWS Session Token (if using temporary credentials). | | No | |
| `NODE_ENV` | Node environment mode. | `development` | No | Affects logging, error details, etc. |

**Security Note:** Do not commit your `.env` file containing sensitive credentials (like AWS keys or production database passwords) to version control. Use a `.gitignore` entry for `.env`.

## Future Work

- Implement an asynchronous processing service (using a message queue or Lambda) to handle video transcoding (`ffmpeg`) and thumbnail generation.
- Add endpoints for listing videos, deleting videos, etc.
- Improve error handling and monitoring.
- Set up a production deployment strategy (e.g., Kubernetes, ECS).
