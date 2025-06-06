# How to Publish SelectionsSaver Extension

Follow these steps to publish a patch update for your VS Code extension:

## 1. Bump the Patch Version

In the root of your extension folder, run:

```
npm version patch
```

This will increment the patch version in your `package.json` (e.g., from 1.0.0 to 1.0.1).

## 2. Package the Extension

If you haven't installed `vsce` (Visual Studio Code Extension Manager), install it globally:

```
npm install -g vsce
```

Then package your extension:

```
vsce package
```

This will create a `.vsix` file in your folder.

## 3. Publish the Extension

To publish to the VS Code Marketplace, you need a Personal Access Token (PAT) from your publisher account.

You can publish and bump the patch version in one step:

```
vsce publish patch
```

Or, if you want to specify the PAT directly:

```
vsce publish --pat <your-personal-access-token>
```

## Summary of Commands

```
npm version patch
vsce package
vsce publish --pat <your-personal-access-token>
```

or simply:

```
vsce publish patch
```

> **Note:**
> - Make sure you are in the `selectionssaver` directory when running these commands.
> - Replace `<your-personal-access-token>` with your actual token.
> - For more details, see the [VSCE documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
