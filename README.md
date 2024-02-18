# YarnClassStringMapper

This is a project that generates a file for pretty-printing minecraft types using yarn mappings.
Generate a YarnStringMapper class for your version and place it in your fabric project.

## Generating a StringMapper

To generate the file clone the project and its submodules:
```bash
git clone --recurse-submodules https://github.com/CubicPulse/YarnClassStringMapper.git
cd YarnClassStringMapper
bun install
```

Then run `sh gen.sh <version>` (i.e. `sh gen.sh 1.20.4`)
