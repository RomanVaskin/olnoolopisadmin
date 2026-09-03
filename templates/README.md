# VK template

Поместите реальный групповой шаблон Ингосстраха в `templates/vk.pdf`.

Генератор поддерживает плоский PDF (наносит данные одного участника на первую страницу) и AcroForm. Для AcroForm распознаются английские имена полей `policy_number`, `policy_date`, `policy_start_date`, `policy_end_date`, `participant_name`, `birth_date`, `passport`, `sport`, `insurance_amount` и их camelCase-варианты.

После добавления реального шаблона координаты плоского layout при необходимости корректируются в `drawFallback()` файла `lib/policy-generator.ts` по печатным полям оригинала.
