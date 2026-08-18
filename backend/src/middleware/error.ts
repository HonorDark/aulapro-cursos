import type {ErrorRequestHandler,RequestHandler} from 'express'
import {ZodError} from 'zod'
import {AppError} from '../utils/errors'
export const notFound:RequestHandler=(_req,_res,next)=>next(new AppError(404,'Ruta no encontrada'))
export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{if(error instanceof ZodError)return res.status(400).json({success:false,message:'Datos inválidos',errors:error.flatten().fieldErrors});if(error instanceof AppError)return res.status(error.status).json({success:false,message:error.message,details:error.details});if((error as {code?:string}).code==='23505')return res.status(409).json({success:false,message:'El registro ya existe'});console.error(error);return res.status(500).json({success:false,message:'Error interno del servidor'})}
