(define-trait payout-trait
    ((send-many ((list 200 {to: principal, ustx: uint, memo: (buff 34)})) (response bool uint))))