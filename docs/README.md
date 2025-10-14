<h1 style="text-align:center;">Hangar Publish</h1>

<p style="text-align:center;">
    <a href="https://github.com/milkdrinkers/Hangar-Publish/blob/main/LICENSE">
        <img alt="GitHub License" src="https://img.shields.io/github/license/milkdrinkers/Hangar-Publish?style=for-the-badge&color=blue&labelColor=141417">
    </a>
    <a href="https://github.com/milkdrinkers/Hangar-Publish/releases">
        <img alt="GitHub Release" src="https://img.shields.io/github/v/release/milkdrinkers/Hangar-Publish?include_prereleases&sort=semver&style=for-the-badge&label=LATEST%20VERSION&labelColor=141417">
    </a>
    <a href="https://github.com/milkdrinkers/Hangar-Publish/issues">
        <img alt="GitHub Issues" src="https://img.shields.io/github/issues/milkdrinkers/Hangar-Publish?style=for-the-badge&labelColor=141417">
    </a>
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/milkdrinkers/Hangar-Publish?style=for-the-badge&labelColor=141417">
</p>

A GitHub Action to automate plugin releases to [Hangar](https://hangar.papermc.io), PaperMC's official plugin repository, forked and imrpoved off of [Ben Woo's Hangar Upload Action](https://github.com/benwoo1110/hangar-upload-action).

---

## 🌟 Features

- Create multi-platform releases on [Hangar](https://hangar.papermc.io) using GitHub Workflows.
- Advanced Glob Pattern matching using [Glob](https://www.npmjs.com/package/glob) in file paths.
- Semver [version ranges support](https://github.com/npm/node-semver#ranges) for dependency definitions like `>=1.19`.

---

## 📦 Setup Instructions

### 1. Get Your Hangar API Token

1. Go to [Hangar Settings](https://hangar.papermc.io/auth/settings/api-keys)
2. Create a new API key with upload permissions
3. Copy the token

### 2. Add Token to GitHub Secrets

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `HANGAR_TOKEN`
4. Value: Your API token from step 1
5. Click "Add secret"

### 3. Add to Workflow

Add `milkdrinkers/Hangar-Publish@v1` to your workflow with the desired configuration.

---

## ⚙️ Configuration

### Required Parameters

| Parameter   | Description |
|-------------|-------------|
| `api_token` | Your Hangar API token |
| `slug`      | Your project's unique identifier on Hangar |
| `version`   | Version string for this release |
| `channel`   | Release channel (e.g., `Release`, `Beta`, `Alpha`, or other custom channel) |
| `files`     | JSON array of file entries to upload (see [File Configuration](#file-configuration)) |

### Optional Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `description` | Release notes/changelog for the release | `""` |
| `plugin_dependencies` | Dependencies on other projects | `{}` |
| `platform_dependencies` | Supported Platforms and Platform versions | `{}` |

---

### Configuring Files

<details>
<summary>Explanation</summary>

`files` specifies which files to upload for what platforms:

- `<array>` - JSON array holding you configurations.
  - `<entry>` - JSON object holding a configuration entry. 
    - `path` a file path to what you wish to upload. Suppports advanced [Glob](https://www.digitalocean.com/community/tools/glob) patterns.
    - `platforms` - JSON array holding a list of platforms.
      - `<platform>` - A platform entry, either `PAPER`, `VELOCITY` or `WATERFALL`.
    - `url` boolean which determines wether to use `path` or `externalURL`. Default, `false`.
    - `externalURL` url to the file to download, used instead of `path`.

#### Upload JAR File
```json
[
  {
    "path": "build/libs/MyPlugin.jar",
    "platforms": ["PAPER"]
  }
]
```

#### Multiple Platform Support
Mark `.jar` compatibility with multiple platforms.

```json
[
  {
    "path": "build/libs/MyPlugin.jar",
    "platforms": ["PAPER", "VELOCITY", "WATERFALL"]
  }
]
```

#### External Download Link
Point to a external download link.

```json
[
  {
    "platforms": ["PAPER"],
    "url": true,
    "externalUrl": "https://github.com/user/repo/releases/download/v1.0.0/plugin.jar"
  }
]
```

#### Multiple Files
Upload different `.jar` files for each platform. 

```json
[
  {
    "path": "build/libs/MyPlugin-Paper.jar",
    "platforms": ["PAPER"]
  },
  {
    "path": "build/libs/MyPlugin-Velocity.jar", 
    "platforms": ["VELOCITY"]
  }
]
```

#### Use Glob Pattern
This will upload any `.jar` files that exist under any directory `/build/libs/`, excluding files with names ending in `-sources.jar` & `-javadoc.jar`.

```json
[
  {
    "path": "**/build/libs/!(*-sources|*-javadoc).jar",
    "platforms": ["PAPER"]
  }
]
```

</details>

### Configuring Dependencies

<details>
<summary>Explanation</summary>

#### Platform Dependencies

`platform_dependencies` specifies which platforms your plugin supports.

- `<object>` - JSON object holding you configuration.
  - `<platform>` - The platform this configuration is for, either `PAPER`, `VELOCITY` or `WATERFALL`.
    - `<array>` a JSON array holding all the supported versions. Suppport

Supported Semver version patterns:
- Exact versions: `"1.20.4"`
- Minimum versions: `">=1.19"`
- Version ranges: `"1.16-1.18.2"`
- Minor version wildcards: `"1.20.x"`

```yaml
platform_dependencies: |
  {
    "PAPER": ["1.20.4", ">=1.19", "1.18.x"],
    "VELOCITY": [">=3.0.0"],
    "WATERFALL": [">=1.19"]
  }
```

#### Plugin Dependencies

`plugin_dependencies` specifies which dependencies your project supports.

- `<object>` - JSON object holding you configuration.
  - `<platform>` - The platform this configuration is for, either `PAPER`, `VELOCITY` or `WATERFALL`.
    - `name` a project slug, or when `externalUrl` is used, the external projects name.
    - `required` wether this dependency is required or not.
    - `externalUrl` optional URL to a project. If not set `name` will be used as a Project Slug.

```yaml
plugin_dependencies: |
  {
    "PAPER": [
      {
        "name": "Vault",
        "required": true
      },
      {
        "name": "PlaceholderAPI", 
        "required": false,
        "externalUrl": "https://www.spigotmc.org/resources/placeholderapi.6245/"
      }
    ]
  }
```

</details>

### Examples

These are some examples of how the action can be used.

<details>
<summary>Basic Plugin Upload</summary>

#### Basic Plugin Upload

```yaml
name: Release
on:
  release:
    types: [published]

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: 21
          distribution: temurin
          
      - name: Build with Gradle
        run: ./gradlew build
        
      - name: Upload to Hangar
        uses: milkdrinkers/Hangar-Publish@v1
        with:
          api_token: ${{ secrets.HANGAR_TOKEN }}
          slug: ${{ github.event.repository.name }}
          version: ${{ github.event.release.tag_name }}
          channel: Release
          description: ${{ github.event.release.body }}
          files: |
            [
              {
                "path": "build/libs/*.jar",
                "platforms": ["PAPER"]
              }
            ]
          platform_dependencies: |
            {
              "PAPER": [">=1.21"]
            }
```

</details>

<details>
<summary>Multi-Platform Plugin</summary>

#### Multi-Platform Plugin

```yaml
- name: Upload to Hangar
  uses: milkdrinkers/Hangar-Publish@v1
  with:
    api_token: ${{ secrets.HANGAR_TOKEN }}
    slug: MyNetworkPlugin
    version: ${{ github.event.release.tag_name }}
    channel: Release
    description: |
      ## What's New
      - Added cross-server messaging
      - Fixed velocity compatibility
      - Updated to support latest Paper builds
    files: |
      [
        {
          "path": "paper/build/libs/!(*-sources|*-javadoc).jar",
          "platforms": ["PAPER"]
        },
        {
          "path": "velocity/build/libs/!(*-sources|*-javadoc).jar", 
          "platforms": ["VELOCITY"]
        },
        {
          "path": "waterfall/build/libs/!(*-sources|*-javadoc).jar",
          "platforms": ["WATERFALL"] 
        }
      ]
    platform_dependencies: |
      {
        "PAPER": [">=1.19"],
        "VELOCITY": [">=3.1.0"], 
        "WATERFALL": [">=1.19"]
      }
    plugin_dependencies: |
      {
        "PAPER": [
          {
            "name": "Vault",
            "required": true
          }
        ]
      }
```

</details>

<details>
<summary>Beta Release Channel</summary>

#### Beta Release Channel

> [!IMPORTANT]
> If using a custom channel, make sure to create it on your project page.

```yaml
- name: Upload Beta to Hangar
  if: contains(github.event.release.tag_name, 'beta')
  uses: milkdrinkers/Hangar-Publish@v1
  with:
    api_token: ${{ secrets.HANGAR_TOKEN }}
    slug: MyPlugin
    version: ${{ github.event.release.tag_name }}
    channel: Beta
    description: |
      **⚠️ This is a beta release - use at your own risk!**
      
      ${{ github.event.release.body }}
    files: |
      [
        {
          "path": "build/libs/MyPlugin-*.jar",
          "platforms": ["PAPER"]
        }
      ]
```

</details>

---

## 🚧 Troubleshooting

### Common Issues

**"Invalid API token"**
- Make sure your token is stored in GitHub Secrets
- Verify the token has upload permissions
- Check that the token hasn't expired

**"Project not found"**  
- Verify the `slug` matches your project's identifier on Hangar
- Ensure your project exists and you have upload permissions

**"Invalid version format"**
- Use semantic versioning (e.g., `1.0.0`, `2.1.3-beta`)
- Avoid special characters in version strings

**"File not found"**
- Check that the file path is correct relative to the workspace
- Ensure your build step completed successfully
- Verify the JAR file was actually created

### Bugs & Feature Requests

If you happen to find any bugs or wish to request a feature, please open an issue on our [issue tracker here](https://github.com/milkdrinkers/Hangar-Publish/issues).

Making your issue easy to read and follow will usually result in it being handled faster. Failure to provide the requested information in an issue may result in it being closed.

---

## 🔧 Contributing

Contributions are always welcome! Please make sure to read our [Contributor's Guide](CONTRIBUTING.md) for before submitting any pull requests.

---

## 📝 License

This repository is licensed under the MIT License. You can find the license, the source code, and all assets are under [here](LICENSE).

---

## ❤️ Acknowledgments

- **[Ben Woo:](https://github.com/benwoo1110)** _For their excellent GitHub Action [Hangar Upload Action](https://github.com/benwoo1110/hangar-upload-action). From which, this action was originally a fork._