// The existing client SHA-256 implementation also works on HTTP installations.
import SHA256 from 'crypto-js/sha256.js'
window.CRA1Shared.CheckoutHash=value=>SHA256(value).toString()
