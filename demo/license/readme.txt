Put your LuciadRIA development license here as:

    luciadria_development.txt

It is gitignored. src/bootstrap.ts imports it with Vite's ?raw suffix and calls setLicenseText()
before anything else loads.
