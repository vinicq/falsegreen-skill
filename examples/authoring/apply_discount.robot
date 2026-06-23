*** Settings ***
Documentation    Rendered from apply-discount.spec.yaml (Mode B). Level: unit.
...              Non-false-green: the expected value (170) comes from the spec.
Library          shop.pricing

*** Test Cases ***
Apply 15 Percent Discount On 200 Returns 170
    ${result}=    Apply Discount    200    0.15
    Should Be Equal As Numbers    ${result}    170    # J2 oracle: 200 - 15% = 170
