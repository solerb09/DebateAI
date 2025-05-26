# Backend Test Suite

This directory contains tests for the Debate Platform backend API.

## Test Structure

- **Integration Tests**: Test the API endpoints and services with mocked dependencies
- **Unit Tests**: Test individual functions and components in isolation

## Running Tests

To run all tests:

```bash
npm test
```

To run specific tests:

```bash
npm test -- tests/integration/audioRoutes.test.js
```

To run tests with coverage report:

```bash
npm test -- --coverage
```

## Test Configuration

Tests are configured using Jest. The main configuration is in `jest.config.js` in the root directory.

### Environment Variables

Tests use mocked environment variables by default, defined in `tests/setup.js`. If you need to test with specific variables, you can set them before running the tests:

```bash
SUPABASE_URL=your-test-url SUPABASE_SERVICE_KEY=your-test-key npm test
```

## Mocks

The tests use the following mocks:

- **Supabase**: Mocked client functions for database operations
- **OpenAI**: Mocked Whisper API for transcription
- **fetch**: Mocked global fetch for HTTP requests
- **File System**: Uses temporary test files that are cleaned up after tests

## Adding New Tests

1. Create a new test file in the appropriate directory
2. Import necessary dependencies and mocks
3. Structure your tests using `describe` and `test` blocks
4. Clean up any resources created during tests

## Debugging Tests

To debug tests with detailed logs, remove the console mocking in `tests/setup.js`. 