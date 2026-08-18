import {Router} from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import {z} from 'zod'
import {query} from '../config/database'
import {env} from '../config/env'
import {authenticate} from '../middleware/auth'
import {asyncHandler} from '../utils/asyncHandler'
import {AppError} from '../utils/errors'
import {publicUser} from '../utils/user'
import type {Role} from '../types'

const router=Router(); const userCols='id,name,email,role,avatar_url,is_active,created_at'
type UserRow={id:string;name:string;email:string;password_hash:string;role:Role;avatar_url:string|null;is_active:boolean;created_at:Date}
const tokenFor=(u:UserRow)=>jwt.sign({role:u.role,email:u.email},env.jwtSecret,{subject:u.id,expiresIn:env.jwtExpiresIn as jwt.SignOptions['expiresIn']})
router.post('/register',asyncHandler(async(req,res)=>{const b=z.object({name:z.string().trim().min(2).max(120),email:z.string().email(),password:z.string().min(8).max(72)}).parse(req.body);const hash=await bcrypt.hash(b.password,12);const {rows}=await query<UserRow>(`INSERT INTO users(name,email,password_hash,role) VALUES($1,LOWER($2),$3,'STUDENT') RETURNING ${userCols},password_hash`,[b.name,b.email,hash]);const u=rows[0]!;res.status(201).json({success:true,data:{token:tokenFor(u),user:publicUser(u)}})}))
router.post('/login',asyncHandler(async(req,res)=>{const b=z.object({email:z.string().email(),password:z.string().min(1)}).parse(req.body);const {rows}=await query<UserRow>('SELECT * FROM users WHERE LOWER(email)=LOWER($1)',[b.email]);const u=rows[0];if(!u||!await bcrypt.compare(b.password,u.password_hash))throw new AppError(401,'Correo o contraseña incorrectos');if(!u.is_active)throw new AppError(403,'Tu cuenta está desactivada');res.json({success:true,data:{token:tokenFor(u),user:publicUser(u)}})}))
router.get('/me',authenticate,asyncHandler(async(req,res)=>{const {rows}=await query<UserRow>(`SELECT ${userCols},password_hash FROM users WHERE id=$1`,[req.user!.id]);const u=rows[0];if(!u||!u.is_active)throw new AppError(401,'La cuenta ya no está disponible');res.json({success:true,data:publicUser(u)})}))
router.post('/change-password',authenticate,asyncHandler(async(req,res)=>{const b=z.object({currentPassword:z.string(),newPassword:z.string().min(8).max(72)}).parse(req.body);const {rows}=await query<UserRow>('SELECT * FROM users WHERE id=$1',[req.user!.id]);const u=rows[0]!;if(!await bcrypt.compare(b.currentPassword,u.password_hash))throw new AppError(400,'La contraseña actual no coincide');await query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(b.newPassword,12),u.id]);res.json({success:true,message:'Contraseña actualizada'})}))
router.post('/forgot-password',asyncHandler(async(req,res)=>{const {email}=z.object({email:z.string().email()}).parse(req.body);const {rows}=await query<UserRow>('SELECT * FROM users WHERE LOWER(email)=LOWER($1) AND is_active=true',[email]);let resetToken:string|undefined;if(rows[0]){resetToken=crypto.randomBytes(32).toString('hex');const hash=crypto.createHash('sha256').update(resetToken).digest('hex');await query('INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL \'30 minutes\')',[rows[0].id,hash])}res.json({success:true,message:'Si la cuenta existe, se generó un enlace de recuperación',...(process.env.NODE_ENV!=='production'&&resetToken?{data:{resetToken}}:{})})}))
router.post('/reset-password',asyncHandler(async(req,res)=>{const b=z.object({token:z.string().length(64),password:z.string().min(8).max(72)}).parse(req.body);const hash=crypto.createHash('sha256').update(b.token).digest('hex');const {rows}=await query<{id:string;user_id:string}>('SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW()',[hash]);if(!rows[0])throw new AppError(400,'El token no es válido o expiró');await query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(b.password,12),rows[0].user_id]);await query('UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1',[rows[0].id]);res.json({success:true,message:'Contraseña restablecida'})}))
export default router
