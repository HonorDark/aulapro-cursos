-- Idempotente: puede ejecutarse nuevamente sin duplicar datos.
INSERT INTO users(name,email,password_hash,role) VALUES
('Sofía Estudiante','student@aulapro.test','$2b$12$7h/7jJCHTtiuZKgPSEdJdOtNen5hYgG.c7OVxD1/wJWyL87pkBN/G','STUDENT'),
('Marco Administrador','admin@aulapro.test','$2b$12$c0PW8sJVx4RsTZjEixJ7BeHvhFXMmCfN5XGM5WmTb7gemD2b9TL1m','ADMIN'),
('Elena Superadmin','superadmin@aulapro.test','$2b$12$d7kOwfH5FhHFd8MHHs03We96CFuY64QWWDprDr/fQSTUp9ivXEQaO','SUPER_ADMIN')
ON CONFLICT ((LOWER(email))) DO NOTHING;

INSERT INTO users(name,email,password_hash,role) VALUES
('Lucía Compradora','lucia@aulaflow.test','$2b$12$7h/7jJCHTtiuZKgPSEdJdOtNen5hYgG.c7OVxD1/wJWyL87pkBN/G','STUDENT')
ON CONFLICT ((LOWER(email))) DO NOTHING;

INSERT INTO categories(name,slug,description) VALUES
('Desarrollo','desarrollo','Programación y tecnología'),('Diseño','diseno','Diseño digital y experiencia de usuario'),
('Negocios','negocios','Gestión, estrategia y emprendimiento'),('Marketing','marketing','Crecimiento y comunicación digital')
ON CONFLICT(slug) DO NOTHING;

INSERT INTO courses(category_id,title,slug,description,instructor,image_url,level,price,duration_minutes,is_published,created_by)
SELECT c.id,v.title,v.slug,v.description,v.instructor,v.image,v.level::course_level,v.price,v.duration,true,u.id
FROM (VALUES
('desarrollo','React y TypeScript profesional','react-typescript','Construye aplicaciones modernas, accesibles y mantenibles desde cero.','Laura Méndez','https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=1200&q=80','INTERMEDIATE',49.00,720),
('desarrollo','Node.js y APIs REST','node-apis','Diseña servicios seguros, escalables y bien estructurados con Express.','Carlos Vega','https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80','INTERMEDIATE',39.00,600),
('diseno','Diseño UX/UI desde cero','ux-ui','Investiga, prototipa y valida experiencias que las personas disfrutan.','Ana Torres','https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1200&q=80','BEGINNER',29.00,480),
('negocios','Liderazgo para equipos ágiles','liderazgo-agil','Herramientas prácticas para liderar equipos de alto rendimiento.','Diego Rojas','https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80','BEGINNER',0.00,300),
('marketing','Marketing digital basado en datos','marketing-datos','Convierte métricas en decisiones y campañas con impacto medible.','Paula Silva','https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80','INTERMEDIATE',35.00,540),
('desarrollo','PostgreSQL: datos que escalan','postgresql','Modela y optimiza bases de datos robustas para productos reales.','Mateo Cruz','https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=1200&q=80','ADVANCED',45.00,660)
) AS v(category,title,slug,description,instructor,image,level,price,duration)
JOIN categories c ON c.slug=v.category JOIN users u ON u.email='admin@aulapro.test'
ON CONFLICT(slug) DO NOTHING;

INSERT INTO modules(course_id,title,position)
SELECT c.id,m.title,m.position FROM courses c CROSS JOIN (VALUES ('Fundamentos',1),('Proyecto práctico',2),('Siguientes pasos',3)) m(title,position)
ON CONFLICT(course_id,position) DO NOTHING;
INSERT INTO lessons(module_id,title,content,video_url,duration_minutes,position,is_preview)
SELECT m.id,CASE p WHEN 1 THEN 'Conceptos esenciales' WHEN 2 THEN 'Práctica guiada' ELSE 'Reto del módulo' END,
'Material práctico y recursos descargables para consolidar lo aprendido.','https://www.youtube.com/embed/dQw4w9WgXcQ',18,p,p=1
FROM modules m CROSS JOIN generate_series(1,3) p ON CONFLICT(module_id,position) DO NOTHING;

INSERT INTO enrollments(user_id,course_id)
SELECT u.id,c.id FROM users u JOIN courses c ON c.slug IN ('react-typescript','ux-ui','marketing-datos','liderazgo-agil') WHERE u.email='student@aulapro.test'
ON CONFLICT(user_id,course_id) DO NOTHING;

-- Progreso variado del estudiante demo: alimenta tarjetas, gráfica histórica y actividad reciente.
WITH desired(slug,completed_lessons) AS (VALUES
 ('react-typescript',7),('ux-ui',5),('marketing-datos',3),('liderazgo-agil',9)
), ranked AS (
 SELECT e.id enrollment_id,l.id lesson_id,d.completed_lessons,
        row_number() OVER(PARTITION BY c.id ORDER BY m.position,l.position) lesson_number
 FROM desired d JOIN courses c ON c.slug=d.slug
 JOIN enrollments e ON e.course_id=c.id
 JOIN users u ON u.id=e.user_id AND u.email='student@aulapro.test'
 JOIN modules m ON m.course_id=c.id JOIN lessons l ON l.module_id=m.id
)
INSERT INTO lesson_progress(enrollment_id,lesson_id,completed,completed_at,updated_at)
SELECT enrollment_id,lesson_id,true,
       date_trunc('month',NOW())-((lesson_number-1)%6)*INTERVAL '1 month'+(lesson_number%12)*INTERVAL '1 day',NOW()
FROM ranked WHERE lesson_number<=completed_lessons
ON CONFLICT(enrollment_id,lesson_id) DO UPDATE SET completed=true,completed_at=EXCLUDED.completed_at,updated_at=NOW();

UPDATE enrollments e SET completed_at=NOW()-INTERVAL '2 days'
FROM users u,courses c WHERE e.user_id=u.id AND e.course_id=c.id
 AND u.email='student@aulapro.test' AND c.slug='liderazgo-agil';

INSERT INTO evaluations(course_id,title,type,due_at)
SELECT c.id,v.title,v.type,v.due_at FROM (VALUES
('react-typescript','Evaluación de componentes','EXAM',NOW()+INTERVAL '7 days'),
('react-typescript','Proyecto de interfaz profesional','PROJECT',NOW()+INTERVAL '14 days'),
('ux-ui','Práctica de prototipado','PRACTICE',NOW()+INTERVAL '10 days'),
('ux-ui','Quiz de investigación UX','QUIZ',NOW()+INTERVAL '18 days'),
('marketing-datos','Análisis de campaña digital','PROJECT',NOW()+INTERVAL '21 days'),
('liderazgo-agil','Caso práctico de liderazgo','PRACTICE',NOW()+INTERVAL '25 days'),
('react-typescript','Quiz de fundamentos React','QUIZ',NOW()-INTERVAL '12 days'),
('ux-ui','Evaluación de fundamentos UX','EXAM',NOW()-INTERVAL '25 days')
) v(slug,title,type,due_at) JOIN courses c ON c.slug=v.slug
WHERE NOT EXISTS(SELECT 1 FROM evaluations e WHERE e.course_id=c.id AND e.title=v.title);

-- Mantiene la agenda demo vigente incluso al volver a ejecutar el seed.
UPDATE evaluations SET due_at=NOW()+INTERVAL '7 days' WHERE title='Evaluación de componentes';
UPDATE evaluations SET due_at=NOW()+INTERVAL '14 days' WHERE title='Proyecto de interfaz profesional';
UPDATE evaluations SET due_at=NOW()+INTERVAL '10 days' WHERE title='Práctica de prototipado';
UPDATE evaluations SET due_at=NOW()+INTERVAL '18 days' WHERE title='Quiz de investigación UX';
UPDATE evaluations SET due_at=NOW()+INTERVAL '21 days' WHERE title='Análisis de campaña digital';
UPDATE evaluations SET due_at=NOW()+INTERVAL '25 days' WHERE title='Caso práctico de liderazgo';
UPDATE evaluations SET due_at=NOW()-INTERVAL '12 days' WHERE title='Quiz de fundamentos React';
UPDATE evaluations SET due_at=NOW()-INTERVAL '25 days' WHERE title='Evaluación de fundamentos UX';

INSERT INTO evaluation_submissions(evaluation_id,user_id,status,score,submitted_at)
SELECT ev.id,u.id,'GRADED',v.score,ev.due_at-INTERVAL '1 day'
FROM (VALUES ('Quiz de fundamentos React',92::numeric),('Evaluación de fundamentos UX',88::numeric)) v(title,score)
JOIN evaluations ev ON ev.title=v.title CROSS JOIN users u WHERE u.email='student@aulapro.test'
ON CONFLICT(evaluation_id,user_id) DO UPDATE SET status='GRADED',score=EXCLUDED.score,submitted_at=EXCLUDED.submitted_at;

INSERT INTO surveys(course_id,title,description,closes_at,is_published,created_by)
SELECT c.id,v.title,v.description,NOW()+v.days*INTERVAL '1 day',true,a.id FROM (VALUES
 ('react-typescript','Encuesta de experiencia del módulo','Cuéntanos qué tan claro y útil resultó el contenido.',12),
 ('ux-ui','Retroalimentación del proyecto UX','Ayúdanos a mejorar las actividades prácticas del curso.',20)
) v(slug,title,description,days) JOIN courses c ON c.slug=v.slug CROSS JOIN users a WHERE a.email='admin@aulapro.test'
AND NOT EXISTS(SELECT 1 FROM surveys s WHERE s.course_id=c.id AND s.title=v.title);
INSERT INTO survey_questions(survey_id,prompt,position)
SELECT s.id,q.prompt,q.position FROM surveys s CROSS JOIN (VALUES
 ('¿Qué fue lo más útil de este módulo?',1),('¿Qué contenido te gustaría reforzar?',2),('¿Cómo calificarías la claridad de las lecciones?',3)
) q(prompt,position) WHERE s.title IN ('Encuesta de experiencia del módulo','Retroalimentación del proyecto UX')
ON CONFLICT(survey_id,position) DO NOTHING;

INSERT INTO course_reviews(course_id,user_id,rating,comment)
SELECT c.id,u.id,v.rating,v.comment FROM (VALUES ('react-typescript',5,'Excelente contenido práctico'),('ux-ui',5,'Muy claro y aplicable')) v(slug,rating,comment)
JOIN courses c ON c.slug=v.slug JOIN users u ON u.email='student@aulapro.test' ON CONFLICT(course_id,user_id) DO NOTHING;

INSERT INTO featured_instructors(name,role,initials,tone,rating,student_count,display_order)
SELECT * FROM (VALUES ('Laura Méndez','Frontend Engineer','LM','purple',4.9::numeric,1840,1),('Carlos Vega','Backend Architect','CV','blue',4.8::numeric,1520,2),('Ana Torres','Product Designer','AT','pink',4.9::numeric,1310,3)) v
WHERE NOT EXISTS(SELECT 1 FROM featured_instructors);
INSERT INTO testimonials(quote,name,role,initials,display_order)
SELECT * FROM (VALUES
('AulaFlow me dio la estructura y la confianza para pasar de estudiar por mi cuenta a trabajar en proyectos reales.','Sofía Ramírez','Frontend Developer','SR',1),
('Pude avanzar a mi ritmo y aplicar cada lección en mi trabajo. En pocas semanas ya veía resultados concretos.','Diego Morales','Analista de Producto','DM',2),
('Los cursos son claros, prácticos y realmente motivadores. Finalmente encontré una plataforma que me ayuda a terminar lo que empiezo.','Camila Torres','Diseñadora UX/UI','CT',3)
) v WHERE NOT EXISTS(SELECT 1 FROM testimonials);

INSERT INTO payment_settings(id,bank_name,account_holder,account_number,account_type,currency,instructions)
VALUES(1,'Banco Nacional de Bolivia','AulaFlow Educación','100-2345678','Caja de ahorro','BOB','Incluye el nombre del estudiante y el curso en la referencia de la transferencia.')
ON CONFLICT(id) DO NOTHING;
UPDATE payment_settings SET qr_image_url='/aulaflow-payment-qr.png' WHERE id=1 AND (qr_image_url IS NULL OR qr_image_url='');

-- Pago pendiente visible al ingresar al módulo administrativo Pagos.
INSERT INTO payments(user_id,course_id,amount,status,payer_name,reference,paid_at,receipt_data,receipt_mime)
SELECT u.id,c.id,c.price,'PENDING','Lucía Compradora','TRX-948271',NOW()-INTERVAL '2 hours',
 'data:image/svg+xml;base64,'||encode(convert_to($receipt$<svg xmlns="http://www.w3.org/2000/svg" width="720" height="920"><rect width="100%" height="100%" fill="#f7f8fc"/><rect x="55" y="55" width="610" height="810" rx="24" fill="white" stroke="#d9ddec" stroke-width="3"/><circle cx="360" cy="155" r="52" fill="#6845ee"/><path d="M330 155h60M360 125v60" stroke="white" stroke-width="12"/><text x="360" y="250" text-anchor="middle" font-family="Arial" font-size="30" font-weight="bold" fill="#171d3b">Comprobante de transferencia</text><text x="105" y="345" font-family="Arial" font-size="22" fill="#778097">Banco</text><text x="615" y="345" text-anchor="end" font-family="Arial" font-size="22" font-weight="bold" fill="#171d3b">Banco Nacional de Bolivia</text><text x="105" y="420" font-family="Arial" font-size="22" fill="#778097">Referencia</text><text x="615" y="420" text-anchor="end" font-family="Arial" font-size="22" font-weight="bold" fill="#171d3b">TRX-948271</text><text x="105" y="495" font-family="Arial" font-size="22" fill="#778097">Pagador</text><text x="615" y="495" text-anchor="end" font-family="Arial" font-size="22" font-weight="bold" fill="#171d3b">Lucía Compradora</text><line x1="105" y1="560" x2="615" y2="560" stroke="#e3e5ee" stroke-width="2"/><text x="360" y="655" text-anchor="middle" font-family="Arial" font-size="22" fill="#778097">MONTO TRANSFERIDO</text><text x="360" y="725" text-anchor="middle" font-family="Arial" font-size="48" font-weight="bold" fill="#6845ee">Bs 45.00</text><text x="360" y="810" text-anchor="middle" font-family="Arial" font-size="18" fill="#32a36b">OPERACIÓN COMPLETADA</text></svg>$receipt$,'UTF8'),'base64'),'image/svg+xml'
FROM users u CROSS JOIN courses c WHERE u.email='lucia@aulaflow.test' AND c.slug='postgresql'
 AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.user_id=u.id AND p.course_id=c.id AND p.status='PENDING');
