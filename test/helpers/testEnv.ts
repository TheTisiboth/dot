// Service logs written while the runner streams results can garble its messages ("Unable to deserialize cloned data")
console.log = () => undefined
console.warn = () => undefined
console.error = () => undefined
