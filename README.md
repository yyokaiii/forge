# Forge

A Visual Studio Code extension that colors comments to make your comments more readable and help you navigate better.
> **Supported Languages:** Python, Javascript.<br />
> More are coming soon.

# Example
<img width="623" height="301" alt="image" src="https://github.com/user-attachments/assets/28259fdf-cfa9-4892-8583-2480edc7742b" />


## Comment colors


```js
/*
! Important
? Question
+ Added
- Removed
* Note
*/
```

The five marker types are enabled by default. Open **Settings** and search for `Forge Comment Colors` to enable or disable each type and choose its color. Defaults are `!` `#c1121f`, `?` `#0077b6`, `+` `#16db65`, `-` `#f9a620`, and `*` `#8367c7`.

The same markers work with the conventional leading asterisk on block comment lines, such as ` * ! Important`.

# Known Issues
Triple quoted text in python will color.
